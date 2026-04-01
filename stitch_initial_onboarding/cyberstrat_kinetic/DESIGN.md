# Design System Specification: Tactical Precision

## 1. Overview & Creative North Star: "The Digital Architect"
This design system is built for the high-stakes world of competitive bot engineering. We are moving away from the "generic dashboard" and toward an interface that feels like a high-end tactical HUD. 

**The Creative North Star: The Digital Architect.**
The UI should feel like a sophisticated blueprint in motion. We achieve this through **Intentional Asymmetry**—where sidebar widths might not match right-hand utility panels—and **Data-Dense Layering**. By using a combination of sharp 4px radiuses and high-contrast typography, we create an environment that feels professional, authoritative, and fast. This is not a social app; it is a command center.

---

## 2. Colors & Surface Philosophy
The palette is grounded in deep obsidian tones, punctuated by high-energy "Electric Indigo" and "Neon Mint." 

### Tone-on-Tone Depth
We rely on the Material-based surface tokens to build depth. 
- **Surface (`#131314`):** The base canvas.
- **Surface-Container-Low (`#1C1B1C`):** For secondary navigation or sidebar backgrounds.
- **Surface-Container-Highest (`#353436`):** For active interactive elements or modal headers.

### The "No-Line" Rule & Glassmorphism
*   **Prohibition of 1px Solid Borders:** Never use a solid 1px border to separate major sections. Instead, use a background shift (e.g., placing a `Surface-Container-Low` sidebar against the `Surface` main content area).
*   **The Glass & Gradient Rule:** For floating panels or bot configuration cards, use `Surface-Variant` with a 60% opacity and a `20px` backdrop blur. 
*   **Signature Textures:** Main Action Buttons (CTAs) should utilize a linear gradient from `Primary` (#C0C1FF) to `Primary-Container` (#8083FF) at a 135-degree angle to provide a "lit" digital effect.

---

## 3. Typography: Tactical Hierarchy
We use a dual-font strategy to balance legibility with a "tech-forward" aesthetic.

*   **Display & Headlines (Space Grotesk):** This font brings a subtle geometric, "engineered" feel. Use `Display-LG` for mission-critical stats or victory screens.
*   **UI & Body (Inter):** Reserved for data tables, configuration labels, and long-form logs. It provides maximum legibility in high-density environments.
*   **Data Accents:** Use `Label-MD` in all-caps with `0.05em` letter spacing for technical metadata (e.g., "LATENCY: 24MS").

---

## 4. Elevation & Depth: Tonal Layering
In this system, elevation is conveyed through light and transparency, not physical shadows.

*   **The Layering Principle:** To "lift" a component, move it up one step in the Surface Container scale. A card sitting on `Surface-Container-Low` should be `Surface-Container-High`.
*   **Ambient Shadows:** If a card must float (e.g., a context menu), use a shadow with a `32px` blur, `8%` opacity, using the `Primary` token color rather than black. This creates a "glow" effect rather than a heavy "drop" shadow.
*   **The Ghost Border:** For accessibility in data-heavy tables, use the `Outline-Variant` token at `15%` opacity. It should be barely felt, acting more as a guide than a hard barrier.

---

## 5. Components & Primitive Styling

### Buttons: Tactical Input
*   **Primary:** Gradient of `Primary` to `Primary-Container`. **Radius: 4px**. High-contrast `On-Primary` text.
*   **Secondary/Ghost:** `Outline` token at 20% opacity. No fill. On hover, transition to `Surface-Container-Highest`.
*   **Tertiary:** Text-only, using `Secondary` (#4EDE93) for "Success/Active" actions or `Tertiary` (#FFB3AD) for "Destructive" actions.

### Configuration Sliders & Inputs
*   **Tactical Sliders:** The track should be `Surface-Container-Highest`. The active fill is `Secondary` (Neon Mint). The handle is a sharp 4px square.
*   **Inputs:** Use `Surface-Container-Lowest` for the field background. Forbid 100% white backgrounds. The active state is indicated by a 1px `Primary` glow on the bottom edge only.

### Status Badges (The "Signal" System)
*   **Active:** `Secondary` (Neon Mint) text on `On-Secondary-Container` background.
*   **In-Battle:** `Primary` (Electric Indigo) text on `On-Primary-Container` background.
*   **Paused/Loss:** `Tertiary` (Crimson) text on `On-Tertiary-Container` background.

### Data Tables & Charts
*   **The "No-Divider" Rule:** Use the **Spacing Scale (1.5 / 0.3rem)** to create breathing room between rows. Use alternating row colors (`Surface` and `Surface-Container-Low`) instead of lines.
*   **Sparklines:** Use `Secondary` for positive trends and `Tertiary` for negative, with a 10% opacity area fill underneath the line.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place a large headline off-center to create a modern, editorial feel.
*   **Use Mono-spacing for Numbers:** Ensure all numerical data in tables uses tabular lining to prevent "jitter" when values update in real-time.
*   **Embrace Negative Space:** High-density data requires *more* white space around the container, not less. Use `Spacing-10` for section padding.

### Don’t:
*   **Don't use Rounded Corners:** Never exceed `Radius-MD` (0.375rem). Circular buttons are strictly prohibited unless they are icon-only floating actions.
*   **Don't use Pure Black:** Always use `Background` (#131314). Pure `#000000` flattens the UI and kills the depth of our tonal layering.
*   **Don't use Heavy Borders:** If a section feels messy, increase the spacing rather than adding a border line.