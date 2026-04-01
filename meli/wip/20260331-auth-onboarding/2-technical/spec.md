# Spec Tecnica: Auth & Onboarding

**Feature**: auth-onboarding | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: JWT con access + refresh tokens
- **Decision**: JWT access token (60min) + refresh token (7d) almacenado en DB.
- **Razon**: Stateless para el access token (no consulta DB en cada request). Refresh en DB permite revocacion.
- **Implementacion**: `python-jose` para JWT, `passlib[bcrypt]` para passwords.

### AD-2: OAuth diferido a post-MVP
- **Decision**: OAuth Google/GitHub se deja como placeholder en frontend. Backend solo implementa email/password.
- **Razon**: OAuth requiere configurar apps en Google/GitHub, redirect URIs, etc. No es critico para MVP. Los botones se muestran en UI pero con tooltip "Coming Soon".
- **Trade-off**: Se pierde el flujo rapido de registro. Aceptable para MVP.

### AD-3: SQLite con SQLAlchemy async
- **Decision**: SQLite via aiosqlite para desarrollo local. PostgreSQL-ready cambiando DATABASE_URL.
- **Constraint**: SQLite no tiene `FOR UPDATE`. Las operaciones atomicas se manejan con IMMEDIATE transactions.

---

## Modelo de Datos

### User
```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    elo: Mapped[int] = mapped_column(Integer, default=1000)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    locked_balance: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    registration_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    bots: Mapped[list["Bot"]] = relationship(back_populates="owner")
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(back_populates="user")
```

### RefreshToken
```python
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid4_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    user: Mapped["User"] = relationship()
```

---

## API Contracts

### POST /api/auth/register
```
Request:
{
    "email": "user@example.com",       // required, valid email format
    "username": "architect_01",         // required, 3-50 chars, alphanumeric + - _
    "password": "securepass123"         // required, min 8 chars
}

Response 201:
{
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer",
    "user": {
        "id": "uuid",
        "email": "user@example.com",
        "username": "architect_01",
        "elo": 1000,
        "balance": 5000,
        "onboarding_completed": false
    }
}

Errors:
  409: {"detail": "Email already registered"} | {"detail": "Username already taken"}
  422: Validation errors
```

**Flujo interno**:
1. Validar inputs (Pydantic).
2. Hash password con bcrypt.
3. Crear User en DB.
4. Llamar `wallet_service.grant_initial(user_id)` → +5000 fichas + LedgerEntry.
5. Generar JWT access + refresh tokens.
6. Guardar refresh token hash en DB.
7. Detectar IP → si >2 registros en 24h desde misma IP → `is_flagged=True`.

### POST /api/auth/login
```
Request:
{
    "email": "user@example.com",
    "password": "securepass123"
}

Response 200:
{
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer",
    "user": { ... }
}

Errors:
  401: {"detail": "Invalid credentials"}
```

### POST /api/auth/refresh
```
Request:
{
    "refresh_token": "eyJ..."
}

Response 200:
{
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",    // rotado
    "token_type": "bearer"
}

Errors:
  401: {"detail": "Invalid or expired refresh token"}
```

**Flujo**: Verificar token hash en DB, verificar no expirado, generar nuevos tokens, invalidar el viejo.

### GET /api/auth/me
```
Headers: Authorization: Bearer <access_token>

Response 200:
{
    "id": "uuid",
    "email": "user@example.com",
    "username": "architect_01",
    "elo": 1000,
    "balance": 5000,
    "locked_balance": 0,
    "onboarding_completed": false,
    "created_at": "2026-03-31T..."
}

Errors:
  401: {"detail": "Not authenticated"}
```

### PUT /api/auth/onboarding
```
Headers: Authorization: Bearer <access_token>

Request:
{
    "username": "new_username",      // opcional, si quiere cambiar
    "preset": "aggressive",          // preset elegido para primer bot
    "bot_name": "Alpha Strike"       // nombre del primer bot
}

Response 200:
{
    "user": { ... onboarding_completed: true },
    "bot": { ... }                   // primer bot creado
}
```

**Flujo interno**:
1. Actualizar username si se cambio.
2. Crear bot via `bot_service.create_bot(user_id, name, preset)`.
3. Marcar `onboarding_completed = True`.

---

## Seguridad

- Passwords: bcrypt con cost factor 12.
- JWT signing: HS256 con SECRET_KEY de env var.
- Access token payload: `{"sub": user_id, "exp": ..., "type": "access"}`.
- Refresh token: UUID aleatorio, solo el hash (SHA256) se guarda en DB.
- Rate limit: 10 intentos de login por IP por 15 minutos (middleware simple).
- Anti-multi-cuenta: log IP en registro, flag si >2 en 24h (solo flag, no bloqueo).

---

## Archivos

```
backend/app/
  api/auth.py           # Endpoints register, login, refresh, me, onboarding
  api/deps.py           # get_current_user dependency (JWT decode)
  services/auth_service.py  # Business logic: register, login, refresh, validate
  models/user.py        # User, RefreshToken models
  schemas/auth.py       # RegisterRequest, LoginRequest, TokenResponse, UserResponse
```

---

## Testing Strategy

### Unit Tests
- `test_auth_service.py`:
  - Registro exitoso: user creado, balance 5000, tokens validos.
  - Registro con email duplicado → 409.
  - Registro con username duplicado → 409.
  - Login exitoso → tokens validos.
  - Login con password incorrecto → 401.
  - Refresh token → nuevos tokens, viejo invalidado.
  - Deteccion multi-cuenta: 3 registros misma IP → flag.

### Integration Tests
- `test_auth_api.py`:
  - Flujo completo: register → login → me → refresh → me.
  - Onboarding: register → onboarding(preset, bot_name) → bot creado + balance 5000.
  - Token expirado → 401 → refresh → nuevo access → me OK.
