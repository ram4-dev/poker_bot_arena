# Spec Tecnica: Backend Code Quality Refactor

**Feature**: backend-code-quality-refactor | **Status**: Approved | **Lang**: es

---

## Contexto

La revision de code quality del backend detecto tres problemas estructurales:

1. `table_manager` depende de atributos internos de `HoldemHand` y viola encapsulamiento.
2. Hay N+1 queries y armado manual de payloads repetido en servicios y APIs.
3. La separacion entre dominio, persistencia y capa HTTP es inconsistente.

No es una iniciativa de seguridad. El foco es mantenibilidad, testabilidad y claridad arquitectonica.

---

## Objetivos

1. Reducir acoplamiento entre `table_manager` y el engine.
2. Eliminar queries repetitivas y mappings dispersos.
3. Clarificar ownership entre servicios de dominio, queries y routers.
4. Mejorar observabilidad y manejo de errores operativos sin cambiar comportamiento funcional.

---

## Decisiones de Arquitectura

### AD-1: `HoldemHand` expone una API estable para lectura y eventos
- **Decision**: Dejar de acceder a campos privados como `_phase`, `_pot`, `_community_cards`, `_events`, `_players`, `_current_actor`.
- **Razon**: `table_manager` no debe romperse si cambia la implementacion interna del engine.
- **Nueva superficie minima**:
```python
hand.current_actor()
hand.current_phase()
hand.current_pot()
hand.community_cards()
hand.initial_events()
hand.seat_for_agent(agent_id)
hand.public_snapshot()
```

### AD-2: Separar query services de command services
- **Decision**: Los endpoints que listan o muestran datos agregados usan query services dedicados. Los servicios de mutacion quedan enfocados en reglas de negocio.
- **Razon**: Hoy `agent_service`, `leaderboard`, `sessions` y `matches` mezclan lecturas complejas, joins implícitos y lógica de presentación.
- **Patron**:
  - `services/*_queries.py`: lectura y shape de respuesta.
  - `services/*_service.py`: mutación y reglas.

### AD-3: Los routers no construyen DTOs complejos a mano
- **Decision**: Los routers delegan a query services y devuelven schemas explícitos.
- **Razon**: Reduce duplicación y inconsistencias de naming.

### AD-4: Eager loading o joins explícitos en endpoints calientes
- **Decision**: Reemplazar N+1 por una de estas estrategias:
  - `selectinload` cuando el shape es relacional simple.
  - queries agregadas con joins cuando hay ranking, rival u owner.
- **Razon**: Mejora performance y simplifica código.

### AD-5: Errores operativos se loguean con contexto
- **Decision**: Evitar `except Exception` silencioso y agregar mensajes con `session_id`, `table_id`, `agent_id` cuando aplique.
- **Razon**: Hace observable el sistema sin alterar contratos.

---

## Refactor Propuesto

### 1. Table Manager y Engine Boundary

#### Problema actual
- `table_manager` consume internals del engine:
  - `hand._phase`
  - `hand._pot`
  - `hand._community_cards`
  - `hand._events`
  - `hand._players`
  - `hand._current_actor`

#### Cambio propuesto
- Agregar métodos públicos a `HoldemHand`.
- Reemplazar lecturas directas por esos métodos.
- Encapsular la traducción engine -> persistence en un mapper pequeño:
```python
def build_hand_event_records(hand: HoldemHand, table: Table, sess1: GameSession, sess2: GameSession) -> list[HandEventModel]
```

#### Regla
- Ningún módulo fuera de `app.engine` debe acceder a atributos prefijados con `_` de `HoldemHand`.

### 2. Query Services

#### Nuevos servicios
```text
backend/app/services/
  agent_queries.py
  leaderboard_queries.py
  match_queries.py
  session_queries.py
```

#### Responsabilidades
- `agent_queries.py`
  - `list_user_agents(db, user_id)`
  - `get_agent_history_page(db, user_id, agent_id, limit, offset)`
- `leaderboard_queries.py`
  - `get_user_leaderboard_page(...)`
  - `get_agent_leaderboard_page(...)`
- `match_queries.py`
  - `list_active_matches(...)`
  - `get_match_live_view(...)`
- `session_queries.py`
  - `list_user_sessions(...)`
  - `get_session_detail_view(...)`

### 3. DTOs y Schemas

#### Problema actual
- Respuestas construidas con dicts inline, nombres inconsistentes y lógica repetida.

#### Cambio propuesto
- Crear o consolidar schemas Pydantic para:
  - `AgentHistoryItem`
  - `LeaderboardEntry`
  - `MatchSeatView`
  - `MatchSummaryView`
  - `SessionListItem`
- Los query services devuelven estructuras ya alineadas con esos schemas.

### 4. Naming y consistencia

#### Regla de naming
- Backend usa un único nombre por concepto.
- Ejemplos:
  - rival del agente: `rival_name`
  - lista paginada: `items`
  - conteo: `total`
- Evitar mezclar `rival_agent`, `opponent_bot_name`, `opp_name`, `sessions/items`.

### 5. Observabilidad

#### Regla
- Cualquier error recuperable en services o scheduler debe registrar:
  - operación
  - recurso afectado
  - excepción

#### Ejemplo
```python
logger.exception(
    "Failed to build agent history page",
    extra={"agent_id": agent_id, "user_id": user_id},
)
```

---

## Archivos Impactados

```text
backend/app/
  engine/holdem.py
  api/agent.py
  api/leaderboard.py
  api/matches.py
  api/sessions.py
  services/agent_service.py
  services/table_manager.py
  services/agent_queries.py
  services/leaderboard_queries.py
  services/match_queries.py
  services/session_queries.py
  schemas/agent.py
  schemas/leaderboard.py
  schemas/session.py
```

---

## Testing Strategy

### Unit
- `test_holdem_public_snapshot_does_not_require_private_fields`
- `test_table_manager_uses_public_engine_api_only`
- `test_agent_history_query_returns_consistent_shape`
- `test_leaderboard_query_avoids_per-row_owner_lookup`

### Integration
- `test_agent_history_endpoint_matches_schema_contract`
- `test_sessions_endpoint_matches_schema_contract`
- `test_matches_endpoint_returns_expected_shape`

### Quality Gates
- No referencias a `hand._*` fuera de `backend/app/engine/`
- No dict payloads complejos construidos inline en routers principales
- Query count establecida para endpoints calientes en tests de integración si el stack lo permite

---

## Criterios de Aceptacion

1. `table_manager` no accede a atributos privados de `HoldemHand`.
2. `agent`, `leaderboard`, `sessions` y `matches` usan query services dedicados.
3. Los endpoints devuelven schemas consistentes y estables, sin naming divergente.
4. Los endpoints calientes dejan de tener N+1 obvios por fila.
5. Los errores operativos relevantes quedan logueados con contexto.

---

## Riesgos y Trade-offs

- Introducir query services agrega archivos, pero baja complejidad accidental en routers.
- Encapsular el engine puede requerir tocar tests existentes que dependen de internals.
- Si no se definen contratos de respuesta antes del refactor, se corre el riesgo de “mejorar” una capa y romper otra.
