# Spec Funcional — elo-balance-fix

## Problema

Al finalizar una partida, dos comportamientos son incorrectos:

### 1. ELO se actualiza dos veces (o ninguna)

Cuando una tabla cierra, se llama `close_session` para cada jugador por separado.
La primera llamada actualiza el ELO de ambos agentes correctamente.
La segunda llamada repite la actualización porque no verifica si el oponente
ya cerró sesión → el ELO queda con valores incorrectos.

Paralelamente, `_settle_completed_sessions` (scheduler tick, paso 4) intenta
arreglar sesiones sin ELO, pero llama a `close_session` sobre sesiones ya
marcadas como `"completed"` → el guard de la función retorna inmediatamente
→ esas sesiones nunca reciben actualización de ELO.

### 2. Saldo puede quedar inconsistente

`settle_session` descuenta `locked_balance -= buy_in` sin verificar que
`locked_balance >= buy_in`. Si por algún motivo el saldo bloqueado no es el
esperado (bug previo, doble cierre, etc.), el valor puede quedar negativo.

Además, cada función de wallet hace su propio `commit` interno, y `close_session`
también hace un `commit` final → hay commits redundantes que dificultan el debug
y pueden generar inconsistencias si algo falla entre medio.

---

## Comportamiento esperado

### ELO

- El ELO de ambos agentes se actualiza **exactamente una vez** por tabla cerrada.
- Si una sesión ya tiene `elo_after` seteado, no se recalcula.
- `_settle_completed_sessions` en el scheduler debe poder recuperar sesiones
  que no recibieron ELO (ej: si el primer close falló antes de llegar al ELO).

### Wallet / Saldo

- `locked_balance` nunca puede quedar negativo. Si `locked_balance < buy_in`
  en el momento del settle, se loguea una advertencia y se usa lo que haya.
- El flujo de commits queda consolidado: las funciones de wallet no commitean
  internamente; el commit final lo hace quien las llama (`close_session`).

---

## Casos de uso

### UC-1: Tabla cierra normalmente (stack cero)
1. Scheduler detecta que no puede arrancar nueva mano (stack ≤ 0).
2. Llama `close_session` para sess1 → ELO se actualiza, wallet se settle.
3. Llama `close_session` para sess2 → ELO **no** se vuelve a actualizar
   (ya fue hecho en el paso anterior).
4. Ambas sesiones quedan con `elo_after` seteado.

### UC-2: Agente abandona voluntariamente
1. Agente llama `POST /game/leave`.
2. Su sesión se cierra → ELO actualizado, wallet settled.
3. Sesión del oponente se cierra → ELO ya seteado, no se toca.

### UC-3: Scheduler recupera sesión sin ELO
1. Sesión A está `"completed"` con `elo_after IS NULL` (ej: fallo previo).
2. Sesión B (oponente) está `"completed"` con `elo_after` seteado o no.
3. Scheduler llama función de recuperación de ELO (separada de `close_session`).
4. ELO se calcula correctamente para ambos.

### UC-4: Saldo bloqueado inconsistente
1. `settle_session` detecta `locked_balance < buy_in`.
2. Loguea warning con los valores.
3. Usa `min(locked_balance, buy_in)` para el descuento.
4. El saldo no queda negativo.

---

## Fuera de alcance

- No se cambia la fórmula de cálculo de ELO (K-factor, profit_ratio).
- No se cambia la lógica de reward_multiplier para práctica.
- No se agrega UI nueva.
