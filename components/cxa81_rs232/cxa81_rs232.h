#pragma once

#include "esphome/core/component.h"
#include "esphome/components/uart/uart.h"
#include "entities.h"

#include <string>
#include <vector>
#include <functional>

namespace esphome {
namespace cxa81_rs232 {

// Forward-declared entity classes (implemented in the platform .py via codegen)
class CXA81PowerSwitch;
class CXA81MuteSwitch;
class CXA81SourceSelect;
class CXA81SimpleButton;

// Main component
class CXA81RS232 : public Component, public uart::UARTDevice {
 public:
  explicit CXA81RS232(uart::UARTComponent *parent) : UARTDevice(parent) {}

  void setup() override;
  void loop() override;

  // Control API used by entities
  void refresh_all();
  void set_power(bool on);
  void set_mute(bool on);
  void source_next();
  void source_prev();
  void set_source_code(int code);

  // Entity registration hooks (called by codegen)
  void set_power_switch(CXA81PowerSwitch *sw) { power_switch_ = sw; }
  void set_mute_switch(CXA81MuteSwitch *sw) { mute_switch_ = sw; }
  void set_source_select(CXA81SourceSelect *sel) { source_select_ = sel; }
  void set_btn_next(CXA81SimpleButton *btn) { btn_next_ = btn; }
  void set_btn_prev(CXA81SimpleButton *btn) { btn_prev_ = btn; }
  void set_btn_refresh(CXA81SimpleButton *btn) { btn_refresh_ = btn; }

  // State getters (useful for entity restore/sync)
  bool power_state() const { return power_; }
  bool mute_state() const { return mute_; }
  const std::string &source_name() const { return source_name_; }
  const std::string &protocol_version() const { return proto_; }
  const std::string &firmware_version() const { return fw_; }
  const std::string &last_error() const { return last_error_; }

  // Callbacks for platform sensors (binary_sensor/text_sensor)
  void add_on_power(std::function<void(bool)> cb) { on_power_.push_back(std::move(cb)); }
  void add_on_mute(std::function<void(bool)> cb) { on_mute_.push_back(std::move(cb)); }
  void add_on_source(std::function<void(const std::string &)> cb) { on_source_.push_back(std::move(cb)); }
  void add_on_error(std::function<void(const std::string &)> cb) { on_error_.push_back(std::move(cb)); }
  void add_on_proto(std::function<void(const std::string &)> cb) { on_proto_.push_back(std::move(cb)); }
  void add_on_fw(std::function<void(const std::string &)> cb) { on_fw_.push_back(std::move(cb)); }

 protected:
  void send_cmd_(uint8_t group, uint8_t number, const char *data = nullptr);
  void handle_line_(const std::string &line);

  void publish_power_(bool v);
  void publish_mute_(bool v);
  void publish_source_from_code_(int code);
  void publish_proto_(const std::string &v);
  void publish_fw_(const std::string &v);
  void publish_error_(const std::string &v);

  void emit_(const std::vector<std::function<void(bool)>> &cbs, bool v);
  void emit_(const std::vector<std::function<void(const std::string &)>> &cbs, const std::string &v);

  // RX buffer
  std::string rx_{};

  // State cache
  bool power_{false};
  bool mute_{false};
  std::string source_name_{"A1"};
  std::string proto_{};
  std::string fw_{};
  std::string last_error_{};

  // Entities (optional depending on YAML)
  CXA81PowerSwitch *power_switch_{nullptr};
  CXA81MuteSwitch *mute_switch_{nullptr};
  CXA81SourceSelect *source_select_{nullptr};

  CXA81SimpleButton *btn_next_{nullptr};
  CXA81SimpleButton *btn_prev_{nullptr};
  CXA81SimpleButton *btn_refresh_{nullptr};

  // Sensor callbacks
  std::vector<std::function<void(bool)>> on_power_;
  std::vector<std::function<void(bool)>> on_mute_;
  std::vector<std::function<void(const std::string &)>> on_source_;
  std::vector<std::function<void(const std::string &)>> on_error_;
  std::vector<std::function<void(const std::string &)>> on_proto_;
  std::vector<std::function<void(const std::string &)>> on_fw_;
};

}  // namespace cxa81_rs232
}  // namespace esphome
