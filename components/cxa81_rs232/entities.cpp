#include "entities.h"
#include "cxa81_rs232.h"

namespace esphome {
namespace cxa81_rs232 {

// Power switch: when HA toggles it, send RS232 command
void CXA81PowerSwitch::write_state(bool state) {
  if (parent_ != nullptr) parent_->set_power(state);
  // Do NOT publish here; wait for amp reply (or refresh) to confirm.
}

// Mute switch
void CXA81MuteSwitch::write_state(bool state) {
  if (parent_ != nullptr) parent_->set_mute(state);
}

// Source select options
void CXA81SourceSelect::setup() {
  this->traits.set_options({
    "A1", "A2", "A3", "A4",
    "D1", "D2", "D3",
    "Bluetooth",
    "USB Audio",
    "A1 Balanced",
  });
}

// When HA selects an option, translate to CXA81 code and send command
void CXA81SourceSelect::control(const std::string &value) {
  if (parent_ == nullptr) return;

  int code = 0;
  if      (value == "A1")          code = 0;
  else if (value == "A2")          code = 1;
  else if (value == "A3")          code = 2;
  else if (value == "A4")          code = 3;
  else if (value == "D1")          code = 4;
  else if (value == "D2")          code = 5;
  else if (value == "D3")          code = 6;
  else if (value == "Bluetooth")   code = 14;
  else if (value == "USB Audio")   code = 16;
  else if (value == "A1 Balanced") code = 20;

  parent_->set_source_code(code);
}

// Buttons: run one of three actions based on kind_
void CXA81SimpleButton::press_action() {
  if (parent_ == nullptr) return;

  switch (kind_) {
    case 1: parent_->source_next(); break;
    case 2: parent_->source_prev(); break;
    case 3: parent_->refresh_all(); break;
    default: break;
  }
}

}  // namespace cxa81_rs232
}  // namespace esphome
