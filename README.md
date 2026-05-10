# esphome-cxa81-rs232

This is a project to program an espHome component into an ESP32 to control a Cambridge Audio CXA81 through it's RS232 Serial Port.

Currently, it's real ugly and but works for all portions of the [serial protocol](https://www.cambridgeaudio.com/sites/default/files/compliance/doc/AP366462%20CXA61%20CXA81%20Serial%20Control%20Protocol%20%281%29.pdf) found at the Cambridge Audio website.

## Parts

These are the parts that were used.

1. ESP32-WROOM-32E [https://kuriosity.sg/products/wifi-bluetooth-module-esp32-wroom-32e-4mb-16mb-flash]
1. MAX3232 [https://shopee.sg/MAX3232-RS232-to-TTL-Serial-Port-Converter-Module-DB9-Connector-MAX232-i.517411014.23924173193]
1. RS232 Serial Cable - DB9 Male to Male Null Modem [https://shopee.sg/DTECH-RS232-Serial-Cable-DB9-Male-To-Male-Null-Modem-Cord-Cross-TX-RX-Line-For-Data-Communication-i.463826951.26987187293]

## cxa81.yaml

```
esphome:
  name: cxa81-rs232
  friendly_name: "CXA81 RS232"

esp32:
  board: esp32dev
  framework:
    type: esp-idf

logger:
  baud_rate: 0

# Enable Home Assistant API
api:
  encryption:
    key: #insert key

ota:
  - platform: esphome
    password: #insert password

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password

  # Enable fallback hotspot (captive portal) in case wifi connection fails
  ap:
    ssid: "CXA81 RS232 Hotspot"
    password: #insert password

uart:
  id: uart_cxa
  tx_pin: GPIO16
  rx_pin: GPIO17
  baud_rate: 9600
  data_bits: 8
  parity: NONE
  stop_bits: 1

external_components:
  - source: github://skie97/esphome-cxa81-rs232
    components: [cxa81_rs232]
    refresh: 0s

cxa81_rs232:
  id: cxa
  uart_id: uart_cxa

binary_sensor:
  - platform: cxa81_rs232
    power:
      name: "CXA81 Power State"
    mute:
      name: "CXA81 Mute State"

text_sensor:
  - platform: cxa81_rs232
    protocol_version:
      name: "CXA81 Protocol Version"
    firmware_version:
      name: "CXA81 Firmware Version"
    current_source:
      name: "CXA81 Current Source"
    last_error:
      name: "CXA81 Last Error"

switch:
  - platform: cxa81_rs232
    power:
      name: "CXA81 Power"
    mute:
      name: "CXA81 Mute"

select:
  - platform: cxa81_rs232
    source:
      name: "CXA81 Source"

button:
  - platform: cxa81_rs232
    source_next:
      name: "CXA81 Source Next"
    source_prev:
      name: "CXA81 Source Previous"
    refresh:
      name: "CXA81 Refresh"
```

## ⚠️ Wiring Note (v0.1)

This component was tested with a common MAX3232 DB9 RS-232 module. On some of these boards, the TTL header silkscreen (`RXD` / `TXD`) may be labeled from the RS-232 perspective rather than the MCU perspective.

For the module used in v0.1 testing, the correct wiring to the ESP32 is:

- **MAX3232 RXD → ESP32 RX**
- **MAX3232 TXD → ESP32 TX**
- **GND → GND**
- **VCC → 3.3V**

This may appear counterintuitive (i.e., no TTL crossover), but was verified in practice. If communication works in only one direction, double-check your module’s labeling and test both orientations.

## Lovelace Card

A custom Lovelace card (`cxa81-card.js`) is included for a remote-style UI on top of the firmware's switches/select/sensors — power LED, source name as the visual hero, source pill grid, and power/mute toggles.

### Install

1. Copy `cxa81-card.js` from this repo into your Home Assistant config directory at `<config>/www/cxa81-card.js`.
2. In HA, go to **Settings → Dashboards → ⋮ (top right) → Resources → Add resource** and add:
   - **URL:** `/local/cxa81-card.js?v=0.1.0` (bump the `?v=` query string whenever you update the file — HA caches custom cards aggressively).
   - **Resource type:** `JavaScript Module`.
3. Find your actual entity IDs in **Developer Tools → States** (search `cxa81`). They are usually prefixed with the ESPHome device name — see the gotcha below.
4. Add the card to a dashboard. In the raw YAML editor:

```yaml
type: custom:cxa81-card
name: "Living Room CXA81"
power_entity:    switch.cxa81_rs232_cxa81_power
mute_entity:     switch.cxa81_rs232_cxa81_mute
source_entity:   select.cxa81_rs232_cxa81_source
refresh_entity:  button.cxa81_rs232_cxa81_refresh        # optional
firmware_entity: sensor.cxa81_rs232_cxa81_firmware_version  # optional
protocol_entity: sensor.cxa81_rs232_cxa81_protocol_version  # optional
error_entity:    sensor.cxa81_rs232_cxa81_last_error        # optional
show_info_footer: true                                  # optional
theme:                                                  # optional accent overrides
  accent: "#d4a657"
  background: "#0e0f11"
```

`power_entity`, `mute_entity`, and `source_entity` are required; the rest are optional.

### ⚠️ Entity-ID gotcha

The example YAML in `cxa81-card.js`'s install comment shows bare IDs like `switch.cxa81_power`. On a real install they are almost always prefixed with the ESPHome device's `name:` — with the example firmware config above (`name: cxa81-rs232`), the actual IDs come out as `switch.cxa81_rs232_cxa81_power`, `select.cxa81_rs232_cxa81_source`, etc.

If the card renders but taps don't do anything and the source / power state stays blank, that's the cause. Open **Developer Tools → States**, search `cxa81`, and copy the IDs from there into your card YAML.
