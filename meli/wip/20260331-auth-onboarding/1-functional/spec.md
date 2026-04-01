# Spec Funcional: Auth & Onboarding

**Feature**: auth-onboarding | **Status**: Draft | **Lang**: es

---

## Problema

Los usuarios necesitan poder registrarse, autenticarse y recibir una introducción guiada al juego que les permita entender el ciclo core (Build → Battle → Learn) y crear su primer bot rápidamente.

---

## Objetivos

1. Proveer registro e inicio de sesión seguro.
2. Guiar al nuevo usuario para que cree su primer bot en la primera sesión.
3. Presentar el producto con una landing page atractiva.

---

## User Stories

### US-1: Registro con email/password
**Como** visitante, **quiero** registrarme con email y contraseña, **para** obtener una cuenta y empezar a jugar.

**Acceptance Criteria**:
- AC-1.1: Formulario con email (único), username (único, 3-50 chars), password.
- AC-1.2: Password hasheado con bcrypt.
- AC-1.3: Al registrarse recibe JWT access token (60min) + refresh token (7d).
- AC-1.4: Se acreditan 5000 fichas ficticias automáticamente (integración con wallet-economy).
- AC-1.5: Validación: email formato válido, username sin caracteres especiales, password mín 8 chars.

### US-2: Login
**Como** usuario registrado, **quiero** iniciar sesión, **para** acceder a mi cuenta.

**Acceptance Criteria**:
- AC-2.1: Login con email + password.
- AC-2.2: Retorna JWT access (60min) + refresh (7d).
- AC-2.3: Endpoint de refresh token para renovar sin re-login.
- AC-2.4: Endpoint GET /me retorna perfil del usuario autenticado.

### US-3: OAuth (Google/GitHub)
**Como** visitante, **quiero** registrarme/iniciar sesión con Google o GitHub, **para** un acceso más rápido.

**Acceptance Criteria**:
- AC-3.1: Botones "Google" y "GitHub" en pantalla de login.
- AC-3.2: Si el email ya existe, vincula la cuenta.
- AC-3.3: Si es nuevo, crea cuenta + pide username en onboarding.

### US-4: Onboarding
**Como** nuevo usuario, **quiero** una guía inicial, **para** entender el juego y crear mi primer bot.

**Acceptance Criteria**:
- AC-4.1: Paso 1: Elegir username único ("Identify Yourself").
- AC-4.2: Paso 2: Ver el ciclo operacional: 1. Build → 2. Battle → 3. Learn.
- AC-4.3: Paso 3: Crear primer bot eligiendo un preset ("Initialize Your Core").
- AC-4.4: Al completar, redirige al dashboard con el bot creado.

### US-5: Landing page
**Como** visitante, **quiero** ver una página de presentación del producto, **para** entender qué es Bot Arena y registrarme.

**Acceptance Criteria**:
- AC-5.1: Hero section: "The Future of Competitive Bot Engineering".
- AC-5.2: Sección features: "From Design to Dominance" con pasos del ciclo.
- AC-5.3: Sección "Engineered for Performance" con stats.
- AC-5.4: CTA prominente: "Ready to Architect Your Victory?" → registro.

---

## Scope

**In**: Registro email/password, JWT auth, refresh tokens, OAuth Google/GitHub, onboarding wizard, landing page, endpoint GET /me.
**Out**: Gestión de perfiles avanzada, 2FA, recuperación de password (futuro), admin de usuarios.

---

## Business Rules

1. Username único, 3-50 caracteres, alfanumérico + guiones/underscores.
2. Email único (case insensitive).
3. JWT access token expira en 60 minutos, refresh en 7 días.
4. Detección multi-cuenta: si mismo IP registra >2 cuentas en 24h → flag interno.
5. El onboarding se muestra solo una vez (al primer login post-registro).

---

## Dependencies

| Dependencia | Tipo | Uso |
|-------------|------|-----|
| wallet-economy | Feature | Acreditación de 5000 fichas al registrarse |
| bot-builder | Feature | Creación del primer bot en onboarding |

---

## Pantallas Stitch

- `landing_page/`: Landing pública
- `login_signup/`: Login/Signup split layout con stats
- `initial_onboarding/`: Wizard de onboarding
