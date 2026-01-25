#pragma once

#include "esphome/components/switch/switch.h"
#include "esphome/components/select/select.h"
#include "esphome/components/button/button.h"

#include <string>

namespace esphome {
namespace cxa81_rs232 {

class CXA81RS232;  // forward declaration

// 1) Power switch entity
class CXA81PowerSwitch : public switch_::Switch {
 public:
  void set_parent(CXA81RS232 *p) { parent_ = p; }

 protected:
  void write_state(bool state) override;

 private:
  CXA81RS232 *parent_{nullptr};
};

// 2) Mute switch entity
class CXA81MuteSwitch : public switch_::Switch {
 public:
  void set_parent(CXA81RS232 *p) { parent_ = p; }

 protected:
  void write_state(bool state) override;

 private:
  CXA81RS232 *parent_{nullptr};
};

// 3) Source select entity
class CXA81SourceSelect : public select::Select {
 public:
  void set_parent(CXA81RS232 *p) { parent_ = p; }
  void setup() override;

 protected:
  void control(const std::string &value) override;

 private:
  CXA81RS232 *parent_{nullptr};
};

// 4) Simple button entity
class CXA81SimpleButton : public button::Button {
 public:
  void set_parent(CXA81RS232 *p) { parent_ = p; }
  void set_kind(uint8_t k) { kind_ = k; }

 protected:
  void press_action() override;

 private:
  CXA81RS232 *parent_{nullptr};
  uint8_t kind_{0};  // 1=next, 2=prev, 3=refresh
};

}  // namespace cxa81_rs232
}  // namespace esphome
