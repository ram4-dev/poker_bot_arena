# Spec Tecnica: Scheduler y Matchmaking

**Feature**: scheduler-matchmaking | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Tick a 5 segundos
- **Decision**: SCHEDULER_INTERVAL_SECONDS = 5 (era 30s en v1).
- **Razon**: Los timeouts son de 30s. Con tick de 30s, un timeout podria tardar hasta 60s en detectarse. 5s garantiza deteccion en <=10s.
- **Trade-off**: Mas load de DB (queries cada 5s). Aceptable para MVP con pocas mesas activas.

### AD-2: Matchmaker con ELO real
- **Decision**: _can_match() implementado. Calculo: allowed_range = BASE + (wait_minutes * EXPANSION_PER_MINUTE). Cap en 1000.
- **Razon**: El ELO matching estaba stubbeado en v1 (siempre True). Necesario para competencia fair.

### AD-3: Timeout detection via DB
- **Decision**: Scheduler hace query de tables con action_deadline < now(). No se usa polling de memoria.
- **Razon**: Stateless y correcto aunque el proceso se reinicie. La DB es la fuente de verdad.

---

## Scheduler Tick (tick.py rewrite)

```python
async def scheduler_tick(db: AsyncSession):
    stats = {"matched": 0, "timeouts": 0, "hands_started": 0, "settled": 0}

    # 1. MATCH QUEUE: emparejar agentes en cola
    matched = await matchmaker.process_queue(db)
    stats["matched"] = matched

    # 2. DETECT TIMEOUTS: mesas con action_deadline vencido
    timed_out = await _process_timeouts(db)
    stats["timeouts"] = timed_out

    # 3. START NEXT HANDS: mesas donde la mano termino pero ambos agentes siguen activos
    started = await _start_pending_hands(db)
    stats["hands_started"] = started

    # 4. SETTLE: sessions completadas pendientes de liquidacion
    settled = await _settle_completed_sessions(db)
    stats["settled"] = settled

    # 5. CLEANUP: destruir mesas con ambas sillas vacias
    await _cleanup_empty_tables(db)

    return stats
```

## Matchmaker (matchmaker.py rewrite)

```python
async def process_queue(db: AsyncSession) -> int:
    """Procesa cola de cada arena. Retorna cantidad de mesas creadas."""
    matched_count = 0
    arenas = await _get_arenas(db)
    for arena in arenas:
        queued = await _get_queued_sessions(db, arena.id)  # ordenados por queued_at
        matched = set()
        for i, s1 in enumerate(queued):
            if s1.id in matched:
                continue
            for s2 in queued[i+1:]:
                if s2.id in matched:
                    continue
                if await _can_match(db, s1, s2):
                    await _create_match(db, s1, s2, arena)
                    matched.add(s1.id)
                    matched.add(s2.id)
                    matched_count += 1
                    break
    return matched_count

async def _can_match(db, s1: Session, s2: Session) -> bool:
    # 1. No mismo usuario
    if s1.user_id == s2.user_id:
        return False
    # 2. Rematch cooldown (5 min)
    if await _has_recent_match(db, s1.agent_id, s2.agent_id):
        return False
    # 3. ELO range check con expansion progresiva
    wait_minutes_s1 = (now() - s1.queued_at).total_seconds() / 60
    wait_minutes_s2 = (now() - s2.queued_at).total_seconds() / 60
    wait_minutes = max(wait_minutes_s1, wait_minutes_s2)
    allowed_range = min(
        settings.MATCHMAKER_ELO_RANGE_BASE + int(wait_minutes * settings.MATCHMAKER_ELO_EXPANSION_PER_MINUTE),
        settings.MATCHMAKER_ELO_RANGE_CAP
    )
    agent1 = await _get_agent(db, s1.agent_id)
    agent2 = await _get_agent(db, s2.agent_id)
    return abs(agent1.elo - agent2.elo) <= allowed_range

async def _create_match(db, s1: Session, s2: Session, arena: Arena):
    # Crear Table
    table = Table(arena_id=arena.id, seat_1_session_id=s1.id, seat_2_session_id=s2.id,
                  dealer_seat=1, status="active")
    db.add(table)
    # Actualizar sessions
    s1.status = "playing"; s1.table_id = table.id
    s2.status = "playing"; s2.table_id = table.id
    # Actualizar agents
    await agent_service.set_status(db, s1.agent_id, "playing")
    await agent_service.set_status(db, s2.agent_id, "playing")
    await db.flush()
    # Iniciar primera mano
    await table_manager.start_new_hand(db, table.id)
```

## Timeout Detection

```python
async def _process_timeouts(db: AsyncSession) -> int:
    """Busca tables con action_deadline vencido y aplica auto-fold."""
    now = datetime.utcnow()
    tables = await db.execute(
        select(Table).where(
            Table.action_deadline != None,
            Table.action_deadline < now,
            Table.status == "active"
        )
    )
    count = 0
    for table in tables.scalars():
        await table_manager.handle_timeout(db, table.id, table.pending_action_agent_id)
        count += 1
    return count
```

---

## Archivos

```
backend/app/
  scheduler/tick.py       # Rewrite completo
  scheduler/jobs.py       # Actualizar intervalo a 5s
  services/matchmaker.py  # Rewrite con ELO real
  config.py               # SCHEDULER_INTERVAL_SECONDS=5
```

---

## Testing Strategy

### Unit Tests (test_matchmaker.py)
- Match con mismo usuario -> False.
- Match con ELO diff 100, range base 200 -> True.
- Match con ELO diff 300, range base 200, 0 minutos espera -> False.
- Match con ELO diff 300, range base 200, 2 minutos espera (200+100=300) -> True.
- Rematch cooldown activo -> False.

### Integration Tests (test_scheduler.py)
- Timeout: setear action_deadline en pasado -> tick detecta -> auto-fold aplicado.
- 3 timeouts consecutivos -> agent auto-leaves.
- Scheduler crea match entre 2 agentes en cola -> Table creada, Sessions en playing.
