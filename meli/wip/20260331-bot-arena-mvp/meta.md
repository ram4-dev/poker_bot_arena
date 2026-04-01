# Feature Metadata

**Feature Name**: bot-arena-mvp
**Feature ID**: feat-20260331-bot-arena-mvp
**Mode**: greenfield
**Project Type**: mvp
**Platform**: backend
**User Profile**: non-technical
**Created**: 2026-03-31
**Last Updated**: 2026-03-31
**Current Stage**: functional

---

## Framework Version

```yaml
framework:
  version_created: "latest"
  version_current: null
  last_compatibility_check: null
  migration_notes: []
```

---

## Project Type Configuration

```yaml
project_type:
  type: mvp
  decision_date: 2026-03-31

  testing:
    unit_tests: critical_only
    ltp_enabled: false
    coverage_target: varies
```

---

## User Profile Configuration

```yaml
user_profile:
  type: non-technical
  source: global
  selected_at: 2026-03-31T00:00:00Z
```

---

## Spec Language

```yaml
spec_language: es
```

---

## LTP Configuration

```yaml
ltp:
  enabled: false
  decision_date: 2026-03-31
  decision_reason: "Personal project, not on Fury platform"
```

---

## Database Migrations

```yaml
migration:
  detected: false
  service_name: null
  service_type: null
  branch_name: null
  branch_status: null
  migration_files: []
```

---

## Team

**Owner**: Ramiro Carnicer (ramirocarnicersouble8@gmail.com)
**Team Members**: Solo developer

---

## Stage History

```yaml
stages:
  functional:
    started: 2026-03-31
    completed: null
    status: pending
    owner: ramiro-carnicer
    approved_by: null
    approved_at: null
    iterations: 0

  technical:
    started: null
    completed: null
    status: pending
    owner: null
    approved_by: null
    approved_at: null
    mcpfury_queried: false
    fury_services_count: 0

  tasks:
    started: null
    completed: null
    status: pending
    approved_by: null
    approved_at: null
    strategy_chosen_by: null
    generated_tasks_count: 0
    iterations: 0
    final_tasks_count: 0

  implementation:
    started: null
    completed: null
    status: pending
    execution_strategy: null
    total_tasks: 0
    completed_tasks: 0
```

---

## Execution Strategy

```yaml
execution_strategy:
  type: null
  chosen_date: null
  estimated_agent_time: null
  estimated_tokens: null
  actual_agent_time: null
  rationale: null
  phases: []
```

---

## Metrics

```yaml
metrics:
  timeline:
    estimated_days: null
    actual_days: null
    variance_percent: null

  effort:
    estimated_hours: null
    actual_hours: null
    variance_percent: null

  quality:
    test_coverage: null
    tests_total: null
    tests_passing: null
    linter_errors: 0
    type_errors: 0

  velocity:
    avg_hours_per_task: null
    estimation_accuracy: null
```

---

## Changes and Deviations

```yaml
changes:
  tasks_added: []
  tasks_removed: []
  tasks_modified: []
  spec_changes:
    functional: []
    technical: []
  risks_materialized: []
```

---

## Validation Overrides

```yaml
overrides:
  functional:
    forced: false
    reason: null
    date: null
  technical:
    forced: false
    reason: null
    date: null
  tasks:
    forced: false
    reason: null
    date: null
  complete:
    forced: false
    reason: null
    date: null
```

---

## Context

Original description saved from user input and MVP document:
Bot Arena es un juego competitivo donde los usuarios crean bots de poker configurables (sliders/presets), los meten en arenas con moneda ficticia, compiten automáticamente contra otros bots, analizan resultados y ajustan su estrategia para volver a competir. El MVP valida que el loop de creación-competencia-análisis-iteración es lo suficientemente adictivo como para retener usuarios.

Stack: Python FastAPI + SQLite + React/TS/Tailwind + PyPokerEngine
Design: Stitch UI "CyberStrat - Tactical Precision" (12 pantallas)

---

## Notes

- Personal project, not deployed on Fury platform
- Using SQLite for dev (PostgreSQL-ready via SQLAlchemy)
- APScheduler in-process instead of Celery+Redis
- PyPokerEngine + treys for poker engine (not custom)
- Hold'em estándar 4 calles (PyPokerEngine no soporta saltear turn)
- Design reference: stitch_initial_onboarding/ (12 screens + DESIGN.md)
