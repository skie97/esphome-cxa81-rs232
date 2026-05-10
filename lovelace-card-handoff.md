# CXA81 Lovelace Card — Handoff Spec

A self-contained brief for building a custom Home Assistant Lovelace card that controls a Cambridge Audio CXA81 integrated amplifier through its RS-232 port (via an ESP32 running [esphome-cxa81-rs232](https://github.com/skie97/esphome-cxa81-rs232)).

This document is the single source of truth — it is intended to be pasted into a fresh Claude session (e.g. claude.ai with artifacts) so the model can produce the card without needing access to the firmware repo.

---

## 1. Context

- **Hardware:** Cambridge Audio CXA81 stereo integrated amplifier. British hi-fi, audiophile-grade, matte black/silver finish, front-panel display showing source.
- **Bridge:** ESP32 + MAX3232 level shifter + null-modem DB9 cable, running an ESPHome external component that speaks the documented Cambridge serial protocol.
- **HA entities are already exposed** by the firmware. The card consumes them — it does not need to know about the protocol.
- **No firmware changes will be made.** If a control is not listed in §3, it cannot exist in the card.

## 2. Goal

Replace the scattered grid of switches / selects / sensors that the firmware exposes with **one cohesive card** that feels like a remote for the amplifier. The card lives in the user's HA dashboard and is configured per-amp (entity IDs are inputs, not hard-coded).

Aesthetic ambition: evoke the CXA81's restrained, premium hi-fi vibe. Dim luminous accents on near-black, generous spacing, the source name as the visual hero (mimicking the amp's front-panel LCD).

## 3. Hard constraints — what the amp CAN and CANNOT do

The Cambridge CXA61/CXA81 RS-232 protocol supports **only** the following capabilities. Anything outside this list is impossible regardless of how nicely it would render.

**Supported:**
- Power on / off
- Mute on / off
- Select source from a fixed list of 10 inputs
- Step source next / previous
- Read protocol version, firmware version
- Receive error responses

**NOT supported — do not include in the UI:**
- Volume control (no serial command exists — the CXA81 does not expose volume over RS-232)
- Bass / treble / balance / tone
- Play / pause / stop / track navigation (it's an amp, not a media renderer)
- Track metadata, album art, source icons from upstream device
- Multi-zone

## 4. Entities consumed

The user supplies these entity IDs in the card YAML. The IDs vary per install — **the card must read them from config, never hard-code**.

> ⚠️ **Heads-up on real entity IDs.** The "Example entity ID" column below is a stripped-down ideal. ESPHome actually slugifies entity IDs from the device's `name:` plus the entity's `name:`, so on a typical install (firmware device name `cxa81-rs232`, entity name `"CXA81 Power"`) the real IDs come out prefixed — e.g. `switch.cxa81_rs232_cxa81_power`, `select.cxa81_rs232_cxa81_source`. Always verify in HA Developer Tools → States before trusting the example IDs as defaults.

| Role               | Example entity ID                        | Domain         | State shape                                                                 | Card uses |
|--------------------|------------------------------------------|----------------|-----------------------------------------------------------------------------|-----------|
| Power (write+read) | `switch.cxa81_power`                    | switch         | `"on"` / `"off"` / `"unavailable"`                                          | Toggle    |
| Mute (write+read)  | `switch.cxa81_mute`                     | switch         | `"on"` / `"off"`                                                            | Toggle    |
| Source (write+read)| `select.cxa81_source`                   | select         | `state` is current source name; `attributes.options` is the full list      | Hero + grid |
| Source next        | `button.cxa81_source_next`              | button         | (stateless trigger)                                                         | Optional  |
| Source previous    | `button.cxa81_source_previous`          | button         | (stateless trigger)                                                         | Optional  |
| Refresh            | `button.cxa81_refresh`                  | button         | (stateless trigger)                                                         | Small icon button |
| Firmware version   | `text_sensor.cxa81_firmware_version`    | sensor         | string                                                                      | Footer / info popover |
| Protocol version   | `text_sensor.cxa81_protocol_version`    | sensor         | string                                                                      | Footer / info popover |
| Last error         | `text_sensor.cxa81_last_error`          | sensor         | string (empty when no error)                                                | Banner when non-empty |

**Important:** there are also `binary_sensor.cxa81_power_state` and `binary_sensor.cxa81_mute_state` mirrors. **Ignore them** — the `switch` entities already reflect the amp-confirmed state (the firmware only publishes after the amp echoes a confirmation), so the binary_sensors are redundant for the card.

The known source list (read at runtime from `select.*.attributes.options`, but documented here for design reference):

```
A1, A2, A3, A4, D1, D2, D3, Bluetooth, USB Audio, A1 Balanced
```

## 5. Card YAML config schema

```yaml
type: custom:cxa81-card
name: "Living Room CXA81"          # optional, displayed as the card title
power_entity: switch.cxa81_power
mute_entity:  switch.cxa81_mute
source_entity: select.cxa81_source
refresh_entity: button.cxa81_refresh        # optional
firmware_entity: sensor.cxa81_firmware_version  # optional
protocol_entity: sensor.cxa81_protocol_version  # optional
error_entity: sensor.cxa81_last_error           # optional
show_info_footer: true              # optional, default true
theme:                              # optional accent overrides
  accent: "#d4a657"                 # warm amber (LCD-style)
  background: "#0e0f11"
```

`setConfig` must throw on missing required keys (`power_entity`, `mute_entity`, `source_entity`).

## 6. Behaviour spec

### Power toggle
- Tap → `hass.callService("switch", "toggle", { entity_id: power_entity })`.
- Display state from `hass.states[power_entity].state`.
- The firmware does NOT publish optimistic state — it waits for the amp to confirm. Show a subtle "pending" indicator (e.g. dim pulse on the power LED) for ~1.5 s after a tap, then let the actual state update drive the UI. Don't fake the state.

### Mute toggle
- Same pattern as power.
- When power is `off`, mute is meaningless — disable or hide the mute control.

### Source selection (hero + grid)
- The hero shows `hass.states[source_entity].state` in large LCD-style type. If state is empty / `unavailable`, show `—`.
- Below the hero, render `attributes.options` as a grid of pill buttons. Tap → `hass.callService("select", "select_option", { entity_id: source_entity, option: <name> })`.
- Highlight the active source. Same pending pattern as power.
- If power is off, dim the source grid but keep it interactive (the amp accepts source changes while off on most firmware revisions — let the amp reject if it must).

### Refresh
- Small icon-only button (e.g. circular-arrows glyph) in a top corner.
- Tap → `hass.callService("button", "press", { entity_id: refresh_entity })`.
- Brief spinner / rotation animation on tap.

### Last error banner
- If `error_entity` is configured AND its state is a non-empty string, render a dismissible banner across the top of the card with the error text.
- "Dismissible" means card-local hide (set a class flag on dismiss); next non-empty error string re-shows it.
- Style: subdued red/amber, not alarming.

### Info footer
- Small text at the bottom: `Firmware {fw} · Protocol {proto}`. Hide if both entities missing.
- Or: tuck behind a small `(i)` icon that opens a popover.

### Unavailable handling
- Any entity with state `"unavailable"` or `undefined` → show `—` for that field, disable its control. The card should never throw on missing optional entities.

## 7. Visual direction

**Vibe:** restrained British hi-fi. Think Bowers & Wilkins, Naim, Cambridge Audio. Not gamer RGB. Not Apple-glassy. Matte, dim, deliberate.

**Layout (rough):**
```
┌──────────────────────────────────────────────────┐
│  ● CXA81                          [↻]  [info]    │  ← title bar; LED dot is power
│                                                  │
│              ┌────────────────────┐              │
│              │      Bluetooth     │              │  ← hero source, large LCD type
│              └────────────────────┘              │
│                                                  │
│   [A1] [A2] [A3] [A4] [D1] [D2] [D3]             │  ← source pill grid
│   [Bluetooth] [USB Audio] [A1 Balanced]          │
│                                                  │
│   ⏻ Power                       🔇 Mute          │  ← bottom toggles
│                                                  │
│   Firmware 1.04 · Protocol 2.0                   │  ← optional footer
└──────────────────────────────────────────────────┘
```

**Palette suggestion (overrideable):**
- Background: near-black `#0e0f11` with a faint gradient or subtle noise.
- Hero text: warm amber `#d4a657` (LCD evocation), or pale phosphor green `#9bd99b` as alt theme.
- Inactive controls: muted graphite.
- Active highlight: amber accent.
- Error banner: muted rust `#7a3a2c` background, off-white text.

**Typography:**
- Hero: a wide, slightly digital display face — IBM Plex Mono, Roboto Mono, or Major Mono Display feel. Generous letter-spacing.
- Body: HA's default sans is fine.

**Power LED:**
- Small dot in the top-left of the title bar.
- Off: dim grey.
- On: glowing amber with a soft box-shadow halo.
- Pending: gentle pulse animation.

**Motion:**
- All transitions ≤200 ms. Cross-fade source-name changes. No bouncy springs.

The user has a parts photo at `cxa81 parts 01.jpg` in the repo, but it shows the ESP32/MAX3232 wiring, not the amplifier — search "Cambridge Audio CXA81 front panel" for genuine visual references.

## 8. Edge cases & gotchas

- **Source name not in options list** — render it in the hero anyway; just don't highlight any pill in the grid.
- **`options` array missing** — fall back to a hard-coded list (the 10 names in §4). This shouldn't happen with the current firmware but is defensive.
- **Card width on mobile** — the source grid must reflow gracefully. Aim for 2–3 columns at narrow widths, 5+ at wide.
- **Theme contrast** — respect HA's `--primary-text-color` etc. as fallbacks so the card doesn't become illegible under custom HA themes the user might have installed.
- **`setConfig` is called on every config edit**, including invalid intermediate states from the YAML editor. Throw `Error` for missing required keys; the dashboard shows that message inline.
- **`hass` setter fires on every state change in HA**, not just this card's entities. Re-render only when one of the configured entity IDs has actually changed (memoise to avoid jitter).
- **Browser caches custom card JS hard.** Bump a version query param in installation docs (`/local/cxa81-card.js?v=0.1.0`).

## 9. API contract reminder

```js
// Reading
this.hass.states[entityId].state
this.hass.states[entityId].attributes.options

// Writing
this.hass.callService("switch", "toggle",        { entity_id });
this.hass.callService("select", "select_option", { entity_id, option });
this.hass.callService("button", "press",         { entity_id });
```

Card class skeleton:

```js
import { LitElement, html, css } from
  "https://unpkg.com/lit-element@2/lit-element.js?module";

class CXA81Card extends LitElement {
  static get properties() { return { hass: {}, _config: {} }; }

  setConfig(config) {
    for (const key of ["power_entity", "mute_entity", "source_entity"]) {
      if (!config[key]) throw new Error(`${key} is required`);
    }
    this._config = config;
  }

  getCardSize() { return 4; }

  render() { /* ... see §7 layout ... */ }

  static get styles() { return css`/* ... */`; }
}

customElements.define("cxa81-card", CXA81Card);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "cxa81-card",
  name: "CXA81 Amplifier",
  description: "Custom card for Cambridge Audio CXA81 over RS-232",
});
```

## 10. Deliverables

Produce a small, self-contained repo (or single-file artefact) suitable for HACS distribution:

- `src/cxa81-card.ts` — the LitElement card (TypeScript preferred, but plain JS is fine).
- `src/cxa81-card-editor.ts` — *optional* graphical config editor (`getConfigElement`).
- `dist/cxa81-card.js` — built bundle (rollup / esbuild).
- `README.md` — installation steps (copy to `<config>/www/`, register resource, sample YAML).
- `hacs.json` — for HACS publishing.
- Build pipeline (`package.json`, rollup or esbuild config).

If the artefact is single-file (Claude artefact constraint), produce `cxa81-card.js` directly with no build step — that's perfectly valid for `/local/` install.

## 11. Out of scope — explicitly do not build

- Volume slider / volume buttons — the protocol does not support it.
- Track / artist / album display — the amp doesn't know.
- Companion-app lockscreen integration — would require a `media_player` entity, declined.
- Multi-amplifier support in one card — one card instance = one amp.
- Direct serial communication from the browser — the ESPHome firmware handles all I/O.

## 12. Acceptance criteria

The built card should:

1. Render correctly when configured with only the three required entity IDs.
2. Render gracefully when optional entities are missing (no console errors).
3. Reflect amp-confirmed state, not optimistic state, after toggles.
4. Show the active source highlighted in the grid AND echoed in the hero.
5. Surface `last_error` text when present, dismissible.
6. Pass HA's "type: custom:cxa81-card" parser without warnings.
7. Look distinctly nicer than the default vertical-stack of switch/select/sensor tiles. (Subjective but the whole point.)
