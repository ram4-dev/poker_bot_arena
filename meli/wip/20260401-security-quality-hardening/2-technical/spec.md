# Spec Tecnica: Security y Code Quality Hardening

**Feature**: security-quality-hardening | **Status**: Approved | **Lang**: es

---

## Contexto

La revision de seguridad y code quality detecto 4 riesgos prioritarios:

1. Endpoint administrativo expuesto sin autenticacion.
2. Endpoint publico de matches que filtra informacion sensible de partidas activas.
3. Secret por defecto inseguro para firma de JWT.
4. Transacciones fragmentadas entre wallet, session y agent, con riesgo de estado parcial.

Adicionalmente hay deuda tecnica que conviene resolver dentro del mismo hardening:

- Tokens guardados en `localStorage`.
- `RATE_LIMIT_PER_MINUTE` definido pero no aplicado.
- Errores tragados en scheduler.
- Lint frontend roto por `any` y patrones de hooks no conformes.

---

## Objetivos

1. Cerrar superficies obvias de abuso remoto.
2. Evitar filtracion de informacion competitiva y de identidad innecesaria.
3. Hacer que auth falle en forma segura si falta configuracion sensible.
4. Volver atomicas las operaciones de sesion y wallet.
5. Dejar una base minima de observabilidad y calidad para evolucionar sin regresiones.

---

## Decisiones de Arquitectura

### AD-1: `/api/admin/*` requiere autenticacion explicita de administrador
- **Decision**: Introducir un dependency dedicado `require_admin_user` y exigirlo en todos los endpoints administrativos.
- **Razon**: Un endpoint operativo no puede quedar publicado por accidente.
- **Detalle**: Para MVP, el rol admin puede modelarse con `settings.ADMIN_API_KEY` o con un flag `User.is_admin`. Si ambos existen, preferir usuario autenticado sobre API key suelta.
- **Trade-off**: Agrega una pequena capa de configuracion operacional, pero reduce mucho el riesgo.

### AD-2: Separar vista publica de matches de vista privada de mesa
- **Decision**: Mantener un endpoint publico de scoreboard/match listing con datos anonimizados y crear una vista autenticada por participante para detalles sensibles.
- **Razon**: La plataforma puede mostrar actividad publica sin romper fair play.
- **Detalle**:
  - Publico: arena, stacks agregados, hands played, estado, ganador final.
  - Privado: cards propias, historial detallado, username rival solo si la politica de producto lo permite.
  - Nunca exponer hole cards del rival en partidas activas.

### AD-3: Configuracion segura por default
- **Decision**: `SECRET_KEY` deja de tener fallback inseguro. En entornos no-test debe ser obligatorio y validado al boot.
- **Razon**: Un default predecible invalida todo el esquema JWT.
- **Detalle**:
  - En `test`, se permite un secret efimero fijo de test.
  - En `dev`/`prod`, ausencia de `SECRET_KEY` debe abortar startup.

### AD-4: Una sola transaccion por caso de uso
- **Decision**: `wallet_service` deja de hacer `commit()` interno cuando es invocado por otros servicios. El commit ocurre en la capa orquestadora (`session_manager`, auth flow, rescue flow).
- **Razon**: Evita estados parciales entre balance, ledger, session y agent.
- **Patron**:
  - Servicios de dominio mutan entidades y agregan ledger entries.
  - La capa de aplicacion hace `flush()` cuando necesita IDs/estado persistido.
  - El `commit()` se hace una sola vez al final del caso de uso.

### AD-5: Refresh token fuera de `localStorage`
- **Decision**: Mover refresh token a cookie `HttpOnly`, `Secure`, `SameSite=Lax` o `Strict` segun el despliegue. El access token puede mantenerse en memoria de app.
- **Razon**: Reduce exfiltracion por XSS.
- **Trade-off**: Requiere ajustar CORS/credentials y el flujo de refresh.

### AD-6: Rate limiting en auth y game polling
- **Decision**: Aplicar rate limiting real sobre `register`, `login`, `refresh` y opcionalmente `game/state`.
- **Razon**: La configuracion actual declara limite pero no lo hace cumplir.
- **Detalle**:
  - `login`: limite por IP + email.
  - `register`: limite por IP.
  - `refresh`: limite por token hash o IP.
  - `game/state`: limite por agent_id o user_id acorde al contrato del MVP.

### AD-7: Los errores operativos no se silencian
- **Decision**: Reemplazar `except Exception: pass` por logging estructurado y contadores de error.
- **Razon**: Los fallos silenciosos impiden detectar corrupcion o jobs degradados.

---

## Cambios por Area

### 1. Backend Auth y Admin

#### `backend/app/config.py`
- Agregar `ENV: str = "dev"`.
- Agregar `ADMIN_API_KEY: str | None = None` si se opta por modo API key.
- Validar `SECRET_KEY`:
  - si `ENV != "test"` y no existe valor real, lanzar error al boot.
  - rechazar explicitamente el string legacy `dev-secret-key-change-in-production`.

#### `backend/app/api/deps.py`
- Incorporar:
```python
async def get_optional_current_user(...)
async def require_admin_user(...)
```
- `require_admin_user` debe verificar una de estas estrategias:
  - Usuario autenticado con flag admin.
  - Header administrativo dedicado validado contra `ADMIN_API_KEY`.

#### `backend/app/api/admin.py`
- Proteger `POST /tick` con `require_admin_user`.
- Responder 401/403 de forma explicita.

#### `backend/app/api/auth.py`
- No cambiar contratos aun, salvo que la migracion a cookies requiera:
  - `set_cookie()` en login/register/refresh.
  - endpoint de logout para invalidar refresh token.

### 2. Backend Matches y Privacidad

#### `backend/app/api/matches.py`
- Dividir en dos niveles:
  - `GET /api/matches`: publico, anonimizado.
  - `GET /api/matches/{table_id}/live`: protegido o sanitizado.
- El payload publico no debe incluir:
  - `username`
  - `session_id`
  - `agent_id` si no es necesario para UX publica
  - `player_1_hole`
  - `player_2_hole`
- El payload autenticado por participante:
  - puede incluir solo las hole cards propias durante mano activa
  - puede incluir hole cards rivales solo al finalizar la mano si la regla del juego lo permite

#### Regla de exposicion de datos
- Activa:
  - publico: no hole cards
  - participante: solo sus cartas
- Completada:
  - publico: summary final
  - participante: historial completo de su mesa

### 3. Backend Transaccional

#### `backend/app/services/wallet_service.py`
- Convertir funciones mutadoras a helpers transaccionales sin `commit()`:
```python
async def lock_buy_in(..., *, commit: bool = False)
async def unlock_buy_in(..., *, commit: bool = False)
async def settle_session(..., *, commit: bool = False)
async def daily_rescue(..., *, commit: bool = True)
```
- Alternativa preferida: separar API publica de helpers internos:
```python
async def lock_buy_in_tx(...)
async def unlock_buy_in_tx(...)
async def settle_session_tx(...)
```
- `daily_rescue` puede seguir haciendo commit propio si permanece como caso de uso independiente.

#### `backend/app/services/session_manager.py`
- `create_session()`:
  - lock buy-in sin commit
  - crear session
  - actualizar status del agent
  - un solo `commit()` al final
  - `rollback()` ante excepcion
- `close_session()`:
  - setear `completed` y `final_stack`
  - settle/refund wallet sin commit intermedio
  - update ELO
  - reset stats del agent
  - un solo `commit()` al final

#### Invariantes
- Si falla `create_session()`, no debe quedar dinero locked sin session queued.
- Si falla `close_session()`, no debe quedar wallet settleado con agent aun en `playing`.
- Cada `LedgerEntry.reference_id` de `session_result` debe corresponder a una sola session cerrada.

### 4. Frontend Auth Storage

#### `frontend/src/api/client.ts`
- Dejar de leer refresh token desde `localStorage`.
- El interceptor de refresh debe usar cookie implícita con `withCredentials`.
- Manejar concurrencia de refresh:
  - un solo refresh en vuelo
  - requests concurrentes esperan la misma promesa

#### `frontend/src/context/AuthContext.tsx`
- Access token en memoria o session state, no persistido en `localStorage`.
- `loading` inicial debe resolverse sin violar reglas de hooks del lint.
- Agregar `logout()` que limpie estado local y llame al backend si existe invalidacion server-side.

### 5. Rate Limiting y Scheduler

#### Rate limiting
- Aplicar middleware o dependency reusable.
- Registrar rechazos con contexto minimo: route, ip, subject.

#### `backend/app/scheduler/tick.py`
- Reemplazar bloques silenciosos por:
```python
except Exception as e:
    logger.exception("Failed settling session", extra={"session_id": gs.id})
```
- Devolver `failed_settlements` en stats si se quiere observabilidad minima.

### 6. Frontend Code Quality

#### `frontend/src/api/wallet.ts`
- Tipar respuestas en vez de `any`.

#### Hooks
- Refactorizar patrones marcados por lint en:
  - `frontend/src/context/AuthContext.tsx`
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/pages/LeaderboardPage.tsx`
- Objetivo: cero violaciones `react-hooks/set-state-in-effect`.

---

## API Contracts Propuestos

### Admin
```http
POST /api/admin/tick
Authorization: Bearer <admin-jwt>
```

Respuesta:
```json
{
  "matched": 1,
  "timeouts": 0,
  "hands_started": 1,
  "settled": 0,
  "cleaned": 0,
  "failed_settlements": 0
}
```

Errores:
- `401 Unauthorized`: credencial ausente o invalida
- `403 Forbidden`: usuario autenticado sin permisos admin

### Public matches
```http
GET /api/matches
```

Respuesta:
```json
{
  "active": [
    {
      "table_id": "uuid",
      "arena": { "name": "Bronze", "slug": "bronze", "small_blind": 5, "big_blind": 10 },
      "hands_played": 12,
      "started_at": "2026-04-01T21:00:00",
      "seat_1": { "label": "Player 1", "stack": 840, "hands_won": 6, "winrate": 0.5 },
      "seat_2": { "label": "Player 2", "stack": 1160, "hands_won": 6, "winrate": 0.5 }
    }
  ],
  "recently_completed": []
}
```

### Private live match
```http
GET /api/matches/{table_id}/live
Authorization: Bearer <user-jwt>
```

Reglas:
- Si el usuario participa en esa mesa: puede ver sus cartas y el historial detallado permitido.
- Si no participa: `403` o respuesta sanitizada segun decision final de producto.

---

## Plan de Migracion

### Fase 1: Cierre de riesgo inmediato
1. Proteger `/api/admin/tick`.
2. Sanitizar `matches` para no exponer hole cards ni usernames.
3. Forzar `SECRET_KEY` seguro al boot.

### Fase 2: Integridad transaccional
1. Quitar `commit()` internos en `wallet_service`.
2. Orquestar commits unicos en `session_manager`.
3. Agregar tests de rollback e invariantes.

### Fase 3: Hardening de auth de frontend
1. Mover refresh token a cookie `HttpOnly`.
2. Actualizar CORS/credentials.
3. Agregar logout server-side.

### Fase 4: Calidad y observabilidad
1. Aplicar rate limiting real.
2. Arreglar lint frontend.
3. Mejorar logs del scheduler.

---

## Testing Strategy

### Security tests
- `test_admin_tick_requires_auth`
- `test_admin_tick_requires_admin_role`
- `test_matches_public_payload_hides_sensitive_fields`
- `test_match_live_hides_opponent_hole_cards_for_non_participant`
- `test_app_fails_startup_with_insecure_secret_key`

### Transaction tests
- `test_create_session_rolls_back_locked_balance_on_failure`
- `test_close_session_is_atomic_when_elo_update_fails`
- `test_close_session_is_idempotent`
- `test_session_result_ledger_written_once`

### Auth/frontend tests
- `test_refresh_uses_http_only_cookie_flow`
- `test_logout_clears_in_memory_auth_state`
- `test_wallet_api_is_fully_typed`

### Quality gates
- `npm run lint` pasa sin errores
- `pytest` pasa para tests existentes y nuevos
- No hay `except Exception: pass` en scheduler paths criticos

---

## Archivos Impactados

```text
backend/app/
  config.py
  main.py
  api/deps.py
  api/admin.py
  api/auth.py
  api/matches.py
  services/session_manager.py
  services/wallet_service.py
  scheduler/tick.py
  schemas/auth.py              # si cambia contrato cookie/logout

frontend/src/
  api/client.ts
  api/wallet.ts
  context/AuthContext.tsx
  pages/DashboardPage.tsx
  pages/LeaderboardPage.tsx
```

---

## Riesgos y Trade-offs

- Migrar refresh token a cookie cambia el modelo de despliegue y obliga a revisar CORS.
- Hacer privado `match_live` puede impactar UX actual de espectador; por eso se recomienda mantener una vista publica sanitizada.
- Unificar transacciones puede requerir retocar tests que hoy asumen commits internos.
- Si el rol admin no existe en modelo, la via mas rapida es `ADMIN_API_KEY`; la via mas limpia a mediano plazo es `User.is_admin`.

---

## Criterios de Aceptacion

1. Ningun endpoint administrativo ejecuta logica operativa sin autenticacion/autorizacion.
2. Ningun endpoint publico expone hole cards activas, `username` o `session_id` sin necesidad funcional justificada.
3. La app no inicia en `dev`/`prod` con `SECRET_KEY` inseguro o ausente.
4. Los flujos `create_session` y `close_session` son atomicos respecto a wallet, session y agent.
5. El frontend deja de persistir refresh token en `localStorage`.
6. El rate limiting configurado se aplica de verdad en auth.
7. El frontend queda con lint verde.
