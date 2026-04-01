# Spec Tecnica: Wallet & Economy

**Feature**: wallet-economy | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Operaciones atomicas con transacciones SQLAlchemy
- **Decision**: Todas las operaciones de wallet (lock, settle, rescue, grant) se ejecutan dentro de una unica transaccion de DB.
- **Razon**: Evitar estados inconsistentes (ej: balance debitado pero locked no acreditado).
- **Implementacion**: `async with session.begin():` para cada operacion.

### AD-2: Balance nunca negativo via CHECK constraint
- **Decision**: CHECK constraint en DB: `balance >= 0` y `locked_balance >= 0`.
- **Razon**: Defensa en profundidad. Aunque el codigo valida, la DB es la ultima barrera.
- **SQLite**: Soporta CHECK constraints nativamente.

### AD-3: Ledger inmutable como audit log
- **Decision**: LedgerEntry es append-only. No se actualiza ni borra.
- **Razon**: Trail de auditoria completo para debugging y deteccion de inconsistencias.

---

## Modelo de Datos

### LedgerEntry
```python
class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
        # "initial_grant" | "session_result" | "daily_rescue" | "buy_in_lock" | "buy_in_unlock"
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # positivo = ingreso, negativo = egreso
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
        # session_id para session_result, null para otros
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), index=True)

    user: Mapped["User"] = relationship(back_populates="ledger_entries")
```

**Nota**: El balance disponible y locked_balance viven en la tabla `users` (no se calculan del ledger). El ledger es solo para historial.

---

## Servicios

### wallet_service.py

```python
async def grant_initial(session: AsyncSession, user_id: str) -> LedgerEntry:
    """Acredita 5000 fichas al registrarse. Idempotente (solo si balance=0 y no hay grants previos)."""

async def lock_buy_in(session: AsyncSession, user_id: str, amount: int) -> LedgerEntry:
    """
    Atomico: balance -= amount, locked_balance += amount.
    Raises InsufficientBalance si balance < amount.
    Crea LedgerEntry tipo 'buy_in_lock'.
    """

async def unlock_buy_in(session: AsyncSession, user_id: str, amount: int) -> LedgerEntry:
    """Para cancelar cola. Atomico: locked_balance -= amount, balance += amount."""

async def settle_session(
    session: AsyncSession, user_id: str, buy_in: int, final_stack: int, session_id: str
) -> LedgerEntry:
    """
    Atomico: locked_balance -= buy_in, balance += final_stack.
    Crea LedgerEntry tipo 'session_result' con amount = final_stack - buy_in.
    """

async def daily_rescue(session: AsyncSession, user_id: str) -> LedgerEntry:
    """
    Si balance=0 y no hay rescue en las ultimas 24h → +500 fichas.
    Raises NotEligible si no cumple condiciones.
    """

async def get_balance(session: AsyncSession, user_id: str) -> dict:
    """Retorna {balance, locked_balance, total: balance + locked_balance}."""

async def get_ledger(
    session: AsyncSession, user_id: str, type_filter: str | None, limit: int, offset: int
) -> list[LedgerEntry]:
    """Retorna historial de transacciones, filtrable por tipo, ordenado por fecha DESC."""
```

---

## API Contracts

### GET /api/wallet
```
Headers: Authorization: Bearer <token>

Response 200:
{
    "balance": 4500,
    "locked_balance": 500,
    "total": 5000
}
```

### GET /api/wallet/ledger
```
Headers: Authorization: Bearer <token>
Query: ?type=session_result&limit=20&offset=0

Response 200:
{
    "items": [
        {
            "id": "uuid",
            "type": "session_result",
            "amount": 350,
            "balance_after": 4850,
            "reference_id": "session-uuid",
            "description": "Session vs BOT_X: +350",
            "created_at": "2026-03-31T..."
        }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
}
```

### POST /api/wallet/rescue
```
Headers: Authorization: Bearer <token>

Response 200:
{
    "balance": 500,
    "ledger_entry": {
        "id": "uuid",
        "type": "daily_rescue",
        "amount": 500,
        "balance_after": 500
    }
}

Errors:
  400: {"detail": "Balance must be 0 to claim rescue"}
  429: {"detail": "Daily rescue already claimed. Next available in Xh Ym"}
```

---

## Reglas de Negocio Implementadas

| Regla | Implementacion |
|-------|---------------|
| Balance nunca negativo | CHECK constraint + validacion en servicio |
| Operaciones atomicas | Una transaccion DB por operacion |
| Rescue: solo si balance=0 | Query `WHERE balance = 0` |
| Rescue: max 1/dia | Query `WHERE type='daily_rescue' AND created_at > now()-24h` |
| Arena practica: ganancias x0.1 | `final_stack = buy_in + (raw_profit * 0.1)` en settle |
| Initial grant: 5000 | Llamado desde auth register |

---

## Archivos

```
backend/app/
  api/wallet.py             # Endpoints wallet, ledger, rescue
  services/wallet_service.py # Business logic atomica
  models/ledger.py          # LedgerEntry model
  schemas/wallet.py         # WalletResponse, LedgerResponse, RescueResponse
```

---

## Testing Strategy

### Unit Tests
- `test_wallet_service.py`:
  - grant_initial: +5000, balance correcto, ledger entry creado.
  - lock_buy_in: balance baja, locked sube, ledger entry.
  - lock_buy_in con balance insuficiente → InsufficientBalance.
  - unlock_buy_in: locked baja, balance sube.
  - settle_session ganancia: locked -= buy_in, balance += final_stack, ledger con amount positivo.
  - settle_session perdida: idem pero amount negativo.
  - daily_rescue: balance=0 → +500. balance>0 → error. Ya reclamado hoy → error.
  - Atomicidad: si falla a mitad → rollback completo.

### Integration Tests
- `test_wallet_api.py`:
  - Register → balance=5000 → lock 100 → balance=4900, locked=100 → settle(100, 250) → balance=5150, locked=0.
  - Rescue flow: balance=0 → rescue → balance=500 → rescue again → 429.
