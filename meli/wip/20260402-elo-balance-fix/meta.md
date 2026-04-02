# Feature: elo-balance-fix
# Created: 2026-04-02
# Framework: Meli SDD Kit

feature_name: elo-balance-fix
feature_date: 20260402
feature_folder: 20260402-elo-balance-fix

project_mode: brownfield
execution_mode: express

spec_language: es

description: >
  Arreglar sistema ELO (cálculo, actualización y persistencia post-partida)
  y revisar la lógica de saldo/wallet (débitos, créditos, buy-in, premio).

## Status
phase: 1-functional
status: in-progress

## Context
- Stack: Python FastAPI + SQLite (SQLAlchemy async)
- ELO service: backend/app/services/elo_service.py
- Wallet service: backend/app/services/wallet_service.py
- Relevant models: Agent, LedgerEntry, GameSession, Hand
