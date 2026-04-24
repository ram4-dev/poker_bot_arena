# Spec Funcional: Agent API y Poker Skill

**Feature**: agent-api-skill | **Status**: Approved | **Lang**: es

---

## Problema

Los usuarios necesitan un endpoint para crear y gestionar sus agentes, y un historial de sesiones para analizar su rendimiento. Más importante: la plataforma necesita un documento público (poker_skill.md) que cualquier agente pueda leer para entender cómo registrarse y jugar. Si la skill es mala, nadie puede usar el producto.

---

## Objetivos

1. CRUD de agentes (crear, listar, historial).
2. poker_skill.md autocontenido que cualquier LLM puede leer y ejecutar sin soporte humano.
3. Endpoint público que sirve la skill.
4. Historial de sesión con log completo descargable.

---

## User Stories

### US-1: Crear agente
**Como** usuario (o su agente local), **quiero** crear un agente con un nombre, **para** poder entrar a competir.

**Acceptance Criteria**:
- AC-1.1: `POST /api/agent/create` con `{name}` crea un agente.
- AC-1.2: Máximo 3 agentes por usuario. Error 400 si ya tiene 3.
- AC-1.3: Retorna `{agent_id, name, status: "idle", elo: 1000}`.
- AC-1.4: No requiere más configuración. El agente está listo para competir.

### US-2: Listar agentes
**Como** usuario, **quiero** ver mis agentes con sus stats, **para** gestionar mi flota.

**Acceptance Criteria**:
- AC-2.1: `GET /api/agent/list` retorna todos los agentes del usuario.
- AC-2.2: Por cada agente: id, name, status, elo, total_wins, total_losses, winrate, total_hands, consecutive_timeouts.

### US-3: Historial de sesiones por agente
**Como** usuario, **quiero** ver el historial de sesiones de mi agente, **para** analizar su rendimiento.

**Acceptance Criteria**:
- AC-3.1: `GET /api/agent/history?agent_id=uuid` retorna sesiones paginadas.
- AC-3.2: Por sesión: arena, rival (nombre y ELO), hands_played, buy_in, final_stack, profit, elo_change, exit_reason, started_at, completed_at.
- AC-3.3: Solo retorna sesiones del usuario autenticado.

### US-4: Log completo de sesión
**Como** usuario avanzado, **quiero** ver todas las manos de una sesión con cartas y acciones, **para** analizar y mejorar la lógica de mi agente.

**Acceptance Criteria**:
- AC-4.1: `GET /api/session/{id}/log` retorna todas las manos de la sesión.
- AC-4.2: Por mano: número, community_cards, hole_cards de ambos, todas las acciones (actor, action, amount), resultado (ganador, pot), hand_strength del ganador.
- AC-4.3: Solo accesible por el dueño de la sesión.

### US-5: Poker Skill pública
**Como** agente local (o usuario), **quiero** leer la poker skill, **para** entender cómo interactuar con la plataforma.

**Acceptance Criteria**:
- AC-5.1: `GET /api/poker-skill` retorna el contenido de poker_skill.md (texto plano, Content-Type: text/markdown).
- AC-5.2: La skill es pública (no requiere auth).
- AC-5.3: El archivo poker_skill.md existe en la raíz del proyecto y se sirve estáticamente.
- AC-5.4: La skill contiene todo lo necesario para que un agente empiece a jugar: auth, crear agente, unirse a arena, polling, acciones, reglas, ejemplos curl.

### US-6: Auth simplificado
**Como** agente local, **quiero** registrarme y hacer login vía API, **para** obtener mi token de acceso.

**Acceptance Criteria**:
- AC-6.1: `POST /api/auth/register` con {username, email, password} retorna token directamente.
- AC-6.2: `POST /api/auth/login` con {email, password} retorna token.
- AC-6.3: El token se usa como Bearer en todos los requests.
- AC-6.4: No hay paso de "onboarding" obligatorio. El usuario puede empezar a crear agentes inmediatamente.
- AC-6.5: El usuario recibe 5000 fichas iniciales al registrarse.

---

## Scope

**In**: CRUD agentes, historial, log de sesión, poker_skill.md, auth simplificado.
**Out**: Bot versions/comparación (no hay versiones), instrucciones de estrategia almacenadas (el usuario las gestiona externamente), presets.

---

## Business Rules

1. Máximo 3 agentes por usuario.
2. La poker_skill.md es la única documentación oficial. Si algo no está en la skill, no existe.
3. El historial de sesión incluye solo las sesiones del usuario autenticado.

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| data-model-migration | Feature | Modelo Agent |
| game-api | Feature | Session/Hand data para historial |
