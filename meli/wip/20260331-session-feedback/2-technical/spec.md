# Spec Tecnica: Session Feedback

**Feature**: session-feedback | **Status**: Approved | **Lang**: es

---

## Decisiones de Arquitectura

### AD-1: Templates con variables (sin LLM)
- **Decision**: Los eventos clave y insights se generan con templates predefinidos + variables contextuales.
- **Razon**: Determinista, rapido, sin costo de infra LLM. 15-20 templates cubren los casos del MVP.
- **Trade-off**: Menos variacion en el lenguaje. Aceptable para MVP.

### AD-2: Feedback generado on-demand (no pre-calculado)
- **Decision**: El feedback se genera al hacer GET del session detail. No se persiste como entidad separada.
- **Razon**: Los HandEvents ya estan persistidos. El feedback es una "vista" derivada. Evita duplicacion.
- **Trade-off**: Re-calculo en cada request. Aceptable: son queries simples sobre pocos eventos.

### AD-3: Insights derivados de patterns en HandEvents
- **Decision**: Analizar frecuencia de acciones (fold rate, aggression rate, bluff success) para generar insights.
- **Razon**: No requiere ML ni LLM. Pure stats sobre datos existentes.

---

## Templates de Eventos Clave

### Seleccion de eventos
De todos los HandEvents de una sesion, seleccionar 3-5 con mayor impacto:
1. **Criterio primario**: pot size (manos con pots grandes son mas relevantes).
2. **Criterio secundario**: significancia estrategica (all-ins, bluffs exitosos, bad beats).

### Templates (15 templates)

```python
TEMPLATES = {
    # Victorias significativas
    "big_pot_win": "Gano un pot de {pot_size} fichas en mano #{hand} con {winning_hand}.",
    "bluff_success": "Bluff exitoso en mano #{hand}: el rival foldeo ante un bet de {amount} fichas en {street}.",
    "all_in_win": "All-in en mano #{hand}: gano con {winning_hand} vs {losing_hand}. Pot: {pot_size}.",
    "comeback_hand": "Recuperacion clave en mano #{hand}: estaba en {stack_before} y gano {pot_size} fichas.",

    # Derrotas significativas
    "big_pot_loss": "Perdio pot de {pot_size} fichas en mano #{hand} por exceso de agresividad en {street}.",
    "bluff_caught": "Bluff fallido en mano #{hand}: el rival hizo call con {opponent_hand}. Perdio {amount}.",
    "all_in_loss": "All-in perdido en mano #{hand}: {losing_hand} vs {winning_hand}. Perdio {pot_size} fichas.",
    "bad_beat": "Bad beat en mano #{hand}: tenia {losing_hand} pero el rival conecto {winning_hand} en {street}.",

    # Patterns de juego
    "fold_exploited": "El rival exploto su alta fold_to_pressure con raises frecuentes ({fold_count} folds en {total_hands} manos).",
    "aggression_paid": "Su agresividad consistente forzo {fold_count} folds del rival, capturando {total_won} fichas sin showdown.",
    "passive_loss": "Juego pasivo en {street_count} manos postflop resulto en pots pequenos ganados y grandes perdidos.",

    # Condiciones de salida
    "left_up": "Se levanto al alcanzar {multiplier}x el buy-in ({final_stack} fichas). Threshold up alcanzado.",
    "left_down": "Se retiro al caer a {multiplier}x el buy-in ({final_stack} fichas). Threshold down alcanzado.",
    "busted": "Stack llego a 0 en mano #{hand}. Perdio el buy-in completo.",
    "max_hands": "Sesion completa: {hands_played} manos jugadas (limite alcanzado)."
}
```

---

## Architect Insights (Analisis de Patterns)

### Strength (que hizo bien)
Analizar HandEvents para detectar:
- Winrate alto en showdowns → "Performed optimally in showdown situations ({winrate}% win rate)."
- C-bet exitoso → "Continuation bets were effective, winning {cbet_win_rate}% of contested pots."
- Fold discipline → "Strong fold discipline: avoided {avoided_losses} fichas in losing situations."

### Vulnerability (que hizo mal)
- Fold rate alto ante pressure → "Struggled against aggressive opponents: folded {fold_rate}% to raises."
- Bluff rate bajo → "Predictable play: only bluffed {bluff_rate}% of opportunities."
- Perdidas en manos grandes → "Lost {big_pot_losses} of {big_pots} large pots (>{threshold} fichas)."

### Advisory (recomendacion)
Mapeo directo de vulnerability a ajuste de slider:
- Fold rate alto → "Consider reducing fold_to_pressure to {suggested_value} for aggressive matchups."
- Bluff rate bajo → "Increase bluff_frequency to {suggested_value} to be less predictable."
- Perdidas grandes → "Adjust survival_priority to {suggested_value} to protect stack in large pots."

---

## Performance Breakdown

Bar chart data: array de {hand_number, profit} para cada mano de la sesion.

```python
def generate_performance_data(hands: list[Hand], session_id: str) -> list[dict]:
    """
    Para cada mano, calcular profit = stack_after - stack_before.
    Retorna: [{"hand": 1, "profit": -10}, {"hand": 2, "profit": 25}, ...]
    """
```

---

## Servicios

### feedback_service.py

```python
async def generate_session_feedback(session: AsyncSession, session_id: str) -> SessionFeedback:
    """
    Genera feedback completo para una sesion.
    1. Cargar session con hands y events.
    2. Seleccionar 3-5 eventos clave por impacto.
    3. Generar descripciones con templates.
    4. Analizar patterns para insights.
    5. Generar performance breakdown.
    """

def select_key_events(hands: list[Hand]) -> list[KeyEvent]:
    """Selecciona 3-5 eventos mas impactantes por pot size y significancia."""

def render_template(template_key: str, variables: dict) -> str:
    """Renderiza un template con variables contextuales."""

def analyze_patterns(hands: list[Hand], session_id: str) -> Insights:
    """Analiza patterns de acciones para generar strength, vulnerability, advisory."""
```

---

## API Contract (Extension del endpoint existente)

### GET /api/sessions/{session_id}
El endpoint de session detail (de arena-matchmaking) se extiende con feedback:

```
Response 200:
{
    "id": "uuid",
    "status": "completed",
    "arena": { "name": "Low Stakes" },
    "bot": { "name": "Alpha Strike", "version": 3 },
    "opponent": { "bot_name": "Rival Bot", "user": "opponent_user" },

    // KPIs
    "kpis": {
        "profit": 350,
        "winrate": 0.70,         // hands_won / hands_played
        "elo_change": +15,
        "duration_seconds": 862,
        "hands_played": 45,
        "hands_won": 28
    },
    "outcome": "victory",        // "victory" | "defeat"

    // Key Events (3-5)
    "key_events": [
        {
            "hand_number": 23,
            "type": "bluff_success",
            "description": "Bluff exitoso en mano #23: el rival foldeo ante un bet de 45 fichas en river.",
            "impact": "positive"     // "positive" | "negative" | "neutral"
        }
    ],

    // Performance Breakdown
    "performance": [
        { "hand": 1, "profit": -10 },
        { "hand": 2, "profit": 25 },
        ...
    ],

    // Architect Insights
    "insights": {
        "strength": "Continuation bets were effective, winning 78% of contested pots.",
        "vulnerability": "Folded 65% to large raises — opponent exploited this pattern.",
        "advisory": "Consider reducing fold_to_pressure to 0.4 for aggressive matchups."
    },

    // Top Rivals
    "rivals": [
        {
            "bot_name": "Rival Bot",
            "user": "opponent_user",
            "outcome": "victory"
        }
    ]
}
```

---

## Archivos

```
backend/app/
  services/feedback_service.py   # Template rendering, event selection, pattern analysis
  schemas/session.py             # SessionFeedbackResponse (extends SessionDetailResponse)
```

**Nota**: No hay modelos nuevos. El feedback se deriva de Hand/HandEvent existentes.

---

## Testing Strategy

### Unit Tests
- `test_feedback_service.py`:
  - select_key_events: dado N manos con pots variados → retorna 3-5 con mayor pot.
  - render_template: cada template genera string valido con variables.
  - analyze_patterns: fold_rate alto → vulnerability about fold_to_pressure.
  - analyze_patterns: high winrate → strength about showdown performance.
  - advisory: vulnerability detectada → recomendacion de slider especifica.

### Integration Tests
- `test_session_feedback.py`:
  - Ejecutar sesion completa → GET session detail → verificar key_events, insights, performance.
  - Sesion con all-in → evento de all-in aparece en key_events.
  - Sesion con 100% folds → vulnerability detectada.
