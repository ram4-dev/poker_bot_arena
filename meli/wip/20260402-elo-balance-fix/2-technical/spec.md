# Spec Técnica — elo-balance-fix

## Arquitectura del fix

### Problema central: ELO se actualiza N veces

**Causa raíz**: `close_session` actualiza ELO de *ambos* jugadores cada vez que
se llama. Como se llama para cada sesión por separado, el par (sess1, sess2)
recibe el update dos veces.

**Solución**: agregar un guard antes de actualizar ELO en `close_session`:

```python
# Solo actualizar si este agente AÚN no tiene elo_after
# Y el oponente tampoco (para que el primero en cerrar lo haga)
if game_sess.elo_after is None:
    opp_sess = ...
    if opp_sess:
        await elo_service.update_elo(session, game_sess, opp_sess)
```

Esto garantiza que solo la primera `close_session` en ejecutarse actualiza ELO.
La segunda ya encuentra `elo_after` seteado y lo saltea.

---

### Problema secundario: `_settle_completed_sessions` es dead code

**Causa raíz**: Llama `close_session` sobre sesiones ya `"completed"` → el guard
de la línea 135 (`if game_sess.status == "completed": return`) aborta inmediatamente.

**Solución**: Reescribir `_settle_completed_sessions` para llamar directamente a
`elo_service.update_elo` sin pasar por `close_session`:

```python
async def _settle_completed_sessions(db: AsyncSession) -> int:
    sessions = (await db.execute(
        select(GameSession).where(
            GameSession.status == "completed",
            GameSession.final_stack.isnot(None),
            GameSession.elo_after.is_(None),
            GameSession.hands_played > 0,
            GameSession.opponent_session_id.isnot(None),
        )
    )).scalars().all()

    count = 0
    for gs in sessions:
        opp = (await db.execute(
            select(GameSession).where(GameSession.id == gs.opponent_session_id)
        )).scalar_one_or_none()
        if not opp:
            continue
        try:
            await elo_service.update_elo(db, gs, opp)
            await db.commit()
            count += 1
        except Exception as e:
            logger.warning(f"ELO recovery failed for session {gs.id}: {e}")
    return count
```

---

### Wallet: locked_balance guard

En `wallet_service.settle_session`, antes de decrementar:

```python
available_locked = min(user.locked_balance, buy_in)
if available_locked < buy_in:
    logger.warning(
        f"locked_balance inconsistency for user {user_id}: "
        f"expected {buy_in}, found {user.locked_balance}"
    )
user.locked_balance -= available_locked
```

---

### Wallet: consolidar commits

Eliminar los `await session.commit()` dentro de `lock_buy_in`, `unlock_buy_in`
y `settle_session`. El commit lo maneja el caller (`close_session` o `create_session`).

Esto simplifica el flujo y evita commits parciales si falla algo entre medio.

> **Nota**: `daily_rescue` mantiene su propio commit porque es un endpoint
> independiente que no pasa por `close_session`.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `backend/app/services/session_manager.py` | Guard ELO en `close_session` (línea ~168) |
| `backend/app/scheduler/tick.py` | Reescribir `_settle_completed_sessions` |
| `backend/app/services/wallet_service.py` | Guard locked_balance + remover commits internos |

## Tests a agregar

- `test_elo_not_double_updated`: cerrar ambas sesiones, verificar que ELO se
  actualizó exactamente una vez (comparar delta esperado).
- `test_elo_recovery_via_scheduler`: sesión completada con `elo_after=None`,
  correr `_settle_completed_sessions`, verificar que ELO queda seteado.
- `test_locked_balance_underflow_guard`: simular `locked_balance=0` al momento
  del settle, verificar que balance no queda negativo.
