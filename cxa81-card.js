/**
 * cxa81-card.js — Custom Lovelace card for the Cambridge Audio CXA81
 * (controlled via skie97/esphome-cxa81-rs232 firmware).
 *
 * Install:
 *   1. Copy this file to <config>/www/cxa81-card.js
 *   2. Settings → Dashboards → ⋮ → Resources → Add resource
 *      URL:  /local/cxa81-card.js?v=0.1.1     (bump v on update; HA caches hard)
 *      Type: JavaScript Module
 *   3. Add a card to your dashboard:
 *        type: custom:cxa81-card
 *        name: "Living Room CXA81"
 *        power_entity:    switch.cxa81_power
 *        mute_entity:     switch.cxa81_mute
 *        source_entity:   select.cxa81_source
 *        refresh_entity:  button.cxa81_refresh        # optional
 *        firmware_entity: sensor.cxa81_firmware_version  # optional
 *        protocol_entity: sensor.cxa81_protocol_version  # optional
 *        error_entity:    sensor.cxa81_last_error        # optional
 *        show_info_footer: true                       # optional
 *        theme:                                       # optional
 *          accent: "#d4a657"
 *          background: "#0e0f11"
 *
 *   IMPORTANT — entity IDs above are illustrative, NOT defaults to copy verbatim.
 *   ESPHome slugifies entity IDs from the device's `name:` plus the entity's
 *   `name:`, so on a typical install (firmware device name `cxa81-rs232`,
 *   entity name "CXA81 Power") they actually come out prefixed:
 *       switch.cxa81_rs232_cxa81_power
 *       switch.cxa81_rs232_cxa81_mute
 *       select.cxa81_rs232_cxa81_source
 *       button.cxa81_rs232_cxa81_refresh
 *       sensor.cxa81_rs232_cxa81_firmware_version
 *       sensor.cxa81_rs232_cxa81_protocol_version
 *       sensor.cxa81_rs232_cxa81_last_error
 *   Open Developer Tools → States in HA and search "cxa81" to find your exact
 *   IDs. If the card renders but taps do nothing / state stays blank, this is
 *   almost certainly the cause.
 *
 * Behaviour notes:
 *   - The firmware does NOT publish optimistic state. After a tap we mark
 *     that entity "pending" for ~1.5s (or until its state changes), and
 *     pulse the affected control. We never fake the state itself.
 *   - We re-render only when one of our configured entity ids actually
 *     changes (HA fires `hass` setter on every state change in the system).
 */

// `lit@2` ships LitElement + html/css + the `nothing` sentinel as a single
// ES module. (lit-element@2 never exported `nothing` — that's why the older
// import URL 404'd on it.)
import {
  LitElement, html, css, nothing,
} from "https://unpkg.com/lit@2.8.0/index.js?module";

const FALLBACK_SOURCES = [
  "A1", "A2", "A3", "A4", "D1", "D2", "D3",
  "Bluetooth", "USB Audio", "A1 Balanced",
];

class CXA81Card extends LitElement {
  static get properties() {
    return {
      hass:     { attribute: false },
      _config:  { state: true },
      _pending: { state: true },   // Set<entity_id>
      _dismissed: { state: true }, // last error string the user dismissed
    };
  }

  constructor() {
    super();
    this._pending = new Set();
    this._pendingTimers = new Map();    // entity_id -> timeout id
    this._lastStates = {};              // for change detection
    this._dismissed = "";
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    for (const key of ["power_entity", "mute_entity", "source_entity"]) {
      if (!config[key]) throw new Error(`${key} is required`);
    }
    this._config = {
      show_info_footer: true,
      ...config,
      theme: {
        accent: "#d4a657",
        background: "#0e0f11",
        ...(config.theme || {}),
      },
    };
  }

  getCardSize() { return 4; }

  // Only re-render if a state we care about has actually changed.
  shouldUpdate(changed) {
    if (!this._config) return false;
    if (changed.has("_pending") || changed.has("_dismissed") || changed.has("_config")) return true;
    if (!changed.has("hass")) return true;
    const ids = this._watchedEntityIds();
    let dirty = false;
    for (const id of ids) {
      const cur = this.hass?.states?.[id];
      const last = this._lastStates[id];
      const sig = cur ? `${cur.state}|${(cur.attributes?.options || []).join(",")}` : "∅";
      if (sig !== last) { this._lastStates[id] = sig; dirty = true; }
    }
    // Clear pending flags when their underlying state has changed.
    if (dirty && this._pending.size) {
      for (const id of [...this._pending]) {
        const sig = this._lastStates[id];
        if (sig && this._pendingSig.get(id) !== sig) this._clearPending(id);
      }
    }
    return dirty;
  }

  _watchedEntityIds() {
    const c = this._config;
    return [
      c.power_entity, c.mute_entity, c.source_entity,
      c.refresh_entity, c.firmware_entity, c.protocol_entity, c.error_entity,
    ].filter(Boolean);
  }

  // ---- Pending state plumbing ---------------------------------------------
  _markPending(entityId) {
    if (!this._pendingSig) this._pendingSig = new Map();
    const cur = this.hass?.states?.[entityId];
    const sig = cur ? `${cur.state}|${(cur.attributes?.options || []).join(",")}` : "∅";
    this._pendingSig.set(entityId, sig);
    const next = new Set(this._pending);
    next.add(entityId);
    this._pending = next;
    // Timeout fallback — if the amp never responds, clear after 1500ms.
    clearTimeout(this._pendingTimers.get(entityId));
    this._pendingTimers.set(entityId, setTimeout(() => this._clearPending(entityId), 1500));
  }
  _clearPending(entityId) {
    clearTimeout(this._pendingTimers.get(entityId));
    this._pendingTimers.delete(entityId);
    if (!this._pending.has(entityId)) return;
    const next = new Set(this._pending);
    next.delete(entityId);
    this._pending = next;
  }
  _isPending(id) { return this._pending.has(id); }

  // ---- Service calls ------------------------------------------------------
  _togglePower() {
    const id = this._config.power_entity;
    this._markPending(id);
    this.hass.callService("switch", "toggle", { entity_id: id });
  }
  _toggleMute() {
    const id = this._config.mute_entity;
    this._markPending(id);
    this.hass.callService("switch", "toggle", { entity_id: id });
  }
  _pickSource(option) {
    const id = this._config.source_entity;
    this._markPending(id);
    this.hass.callService("select", "select_option", { entity_id: id, option });
  }
  _refresh() {
    const id = this._config.refresh_entity;
    if (!id) return;
    // No state to confirm; just animate the icon.
    const btn = this.renderRoot?.querySelector(".refresh-icon");
    if (btn) {
      btn.classList.remove("spin");
      // force reflow then re-add so it animates again on rapid taps
      void btn.offsetWidth;
      btn.classList.add("spin");
    }
    this.hass.callService("button", "press", { entity_id: id });
  }

  // ---- Render -------------------------------------------------------------
  _stateOf(id) {
    if (!id) return undefined;
    const s = this.hass?.states?.[id];
    if (!s) return undefined;
    if (s.state === "unavailable" || s.state === "unknown") return undefined;
    return s;
  }

  render() {
    if (!this._config || !this.hass) return html``;
    const c = this._config;

    const power = this._stateOf(c.power_entity);
    const mute  = this._stateOf(c.mute_entity);
    const src   = this._stateOf(c.source_entity);
    const fw    = this._stateOf(c.firmware_entity);
    const proto = this._stateOf(c.protocol_entity);
    const errEntity = this._stateOf(c.error_entity);

    const isOn    = power?.state === "on";
    const isMuted = mute?.state  === "on";
    const srcName = src?.state || "—";
    const options = src?.attributes?.options?.length ? src.attributes.options : FALLBACK_SOURCES;
    const errText = (errEntity?.state || "").trim();

    // Custom theme vars (config-overridable)
    const themeStyle = `--cxa-accent:${c.theme.accent};--cxa-bg:${c.theme.background};`;

    return html`
      <ha-card style=${themeStyle} ?data-standby=${!isOn}>
        ${errText && errText !== this._dismissed ? html`
          <div class="error">
            <span>⚠ ${errText}</span>
            <button class="error-x" @click=${() => this._dismissed = errText}>×</button>
          </div>
        ` : nothing}

        <div class="body">
          <!-- Title bar -->
          <div class="bar">
            <span class="led" ?data-on=${isOn}
                  class="led ${this._isPending(c.power_entity) ? "pending" : ""}"></span>
            <span class="wordmark">CXA81</span>
            ${c.name ? html`<span class="subtitle">· ${c.name}</span>` : nothing}
            <span class="spacer"></span>
            ${c.refresh_entity ? html`
              <button class="icon-btn" title="Refresh" @click=${this._refresh}>
                <svg class="refresh-icon" width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>
                </svg>
              </button>
            ` : nothing}
          </div>

          <!-- Hero -->
          <div class="hero-wrap standby-fade">
            <div class="hero">${srcName}</div>
          </div>

          <!-- Pill grid -->
          <div class="pills standby-fade">
            ${options.map(opt => html`
              <button class="pill ${this._isPending(c.source_entity) && opt === srcName ? "pending" : ""}"
                      ?data-active=${opt === srcName}
                      @click=${() => this._pickSource(opt)}>
                ${opt}
              </button>
            `)}
          </div>

          <!-- Bottom row -->
          <div class="bottom">
            <button class="toggle ${this._isPending(c.power_entity) ? "pending" : ""}"
                    ?data-on=${isOn}
                    @click=${this._togglePower}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v9"/><path d="M5.5 7a8 8 0 1 0 13 0"/>
              </svg>
              <span>Power</span>
            </button>
            <button class="toggle ${this._isPending(c.mute_entity) ? "pending" : ""}"
                    ?data-on=${isMuted} ?disabled=${!isOn}
                    @click=${this._toggleMute}>
              ${isMuted ? html`
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z"/>
                  <line x1="22" y1="9"  x2="16" y2="15"/>
                  <line x1="16" y1="9"  x2="22" y2="15"/>
                </svg>
              ` : html`
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z"/>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
                  <path d="M19 5a9 9 0 0 1 0 14"/>
                </svg>
              `}
              <span>${isMuted ? "Muted" : "Mute"}</span>
            </button>
            <span class="spacer"></span>
            ${c.show_info_footer && (fw || proto) ? html`
              <span class="footer">
                ${fw    ? html`FW ${fw.state}` : nothing}${fw && proto ? " · " : ""}
                ${proto ? html`PROTO ${proto.state}` : nothing}
              </span>
            ` : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        --cxa-accent: #d4a657;
        --cxa-bg: #0e0f11;
        --cxa-text: #e8e6df;
        --cxa-text-dim: rgba(232, 230, 223, 0.45);
        --cxa-text-vdim: rgba(232, 230, 223, 0.28);
        --cxa-stroke: rgba(255, 255, 255, 0.08);
        --cxa-stroke-bright: rgba(255, 255, 255, 0.14);
        --cxa-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
        --cxa-sans: 'IBM Plex Sans', var(--primary-font-family, -apple-system, system-ui, sans-serif);
      }

      ha-card {
        background: var(--cxa-bg);
        color: var(--cxa-text);
        font-family: var(--cxa-sans);
        border-radius: var(--ha-card-border-radius, 14px);
        overflow: hidden;
        position: relative;
        user-select: none;
        -webkit-font-smoothing: antialiased;
        box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 28px rgba(0,0,0,0.35);
      }

      /* Standby breathing — applied via .standby-fade children. */
      @keyframes cxa-standby {
        0%, 100% { opacity: 0.62; }
        50%      { opacity: 0.86; }
      }
      ha-card[data-standby] .standby-fade {
        animation: cxa-standby 4.5s ease-in-out infinite;
      }

      @keyframes cxa-pulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }
      .pending { animation: cxa-pulse 0.9s ease-in-out infinite; }

      .body {
        padding: 14px 16px 16px;
        display: flex; flex-direction: column; gap: 14px;
        box-sizing: border-box;
      }

      .bar { display: flex; align-items: center; gap: 8px; }
      .spacer { flex: 1; }

      .led {
        width: 7px; height: 7px; border-radius: 50%;
        background: #2a2722;
        box-shadow: inset 0 0 1px rgba(0,0,0,0.6);
        transition: background 200ms ease, box-shadow 200ms ease;
        flex-shrink: 0;
      }
      .led[data-on] {
        background: var(--cxa-accent);
        box-shadow: 0 0 6px var(--cxa-accent), 0 0 12px rgba(212,166,87,0.5);
      }

      .wordmark {
        font-weight: 500;
        font-size: 10px;
        letter-spacing: 0.22em;
        color: var(--cxa-text-dim);
        text-transform: uppercase;
      }
      .subtitle { color: var(--cxa-text-vdim); font-size: 11px; }

      .icon-btn {
        width: 26px; height: 26px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 6px; border: 0;
        background: transparent;
        color: var(--cxa-text-dim);
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease;
        padding: 0;
      }
      .icon-btn:hover  { background: rgba(255,255,255,0.05); color: var(--cxa-text); }
      .icon-btn:active { background: rgba(255,255,255,0.08); }

      @keyframes cxa-spin { to { transform: rotate(360deg); } }
      .refresh-icon.spin { animation: cxa-spin 700ms linear; }

      .hero-wrap {
        flex: 1; display: flex; align-items: center; justify-content: center;
        min-height: 56px;
      }
      .hero {
        font-family: var(--cxa-mono);
        color: var(--cxa-accent);
        font-weight: 300;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 28px;
        text-shadow: 0 0 18px rgba(212,166,87,0.18);
        transition: opacity 180ms ease;
      }

      .pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
      .pill {
        font-family: var(--cxa-mono);
        font-size: 11px; font-weight: 400;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 6px 10px;
        border-radius: 6px;
        background: rgba(255,255,255,0.025);
        border: 1px solid var(--cxa-stroke);
        color: var(--cxa-text-dim);
        cursor: pointer;
        transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
        white-space: nowrap;
      }
      .pill:hover { background: rgba(255,255,255,0.05); color: var(--cxa-text); border-color: var(--cxa-stroke-bright); }
      .pill[data-active] {
        color: var(--cxa-accent);
        border-color: rgba(212,166,87,0.5);
        background: rgba(212,166,87,0.08);
      }

      .bottom { display: flex; gap: 8px; align-items: center; }
      .toggle {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(255,255,255,0.025);
        border: 1px solid var(--cxa-stroke);
        color: var(--cxa-text-dim);
        font-size: 12px; font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 140ms ease;
        font-family: inherit;
      }
      .toggle:hover { color: var(--cxa-text); background: rgba(255,255,255,0.045); border-color: var(--cxa-stroke-bright); }
      .toggle[data-on] {
        color: var(--cxa-accent);
        border-color: rgba(212,166,87,0.45);
        background: rgba(212,166,87,0.06);
      }
      .toggle[disabled] { opacity: 0.35; cursor: not-allowed; }

      .footer {
        font-family: var(--cxa-mono);
        font-size: 9.5px;
        color: var(--cxa-text-vdim);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .error {
        background: rgba(122, 58, 44, 0.35);
        color: #e8c2b3;
        font-size: 11px;
        padding: 6px 10px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px;
      }
      .error-x {
        background: transparent; border: 0; color: inherit; cursor: pointer;
        font-size: 14px; line-height: 1; padding: 0 4px;
      }
    `;
  }
}

if (!customElements.get("cxa81-card")) {
  customElements.define("cxa81-card", CXA81Card);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "cxa81-card")) {
  window.customCards.push({
    type: "cxa81-card",
    name: "CXA81 Amplifier",
    description: "Custom card for Cambridge Audio CXA81 over RS-232",
    preview: false,
  });
}

console.info(
  "%c CXA81-CARD %c v0.1.0 ",
  "color:#0e0f11;background:#d4a657;font-weight:700",
  "color:#d4a657;background:#0e0f11"
);
