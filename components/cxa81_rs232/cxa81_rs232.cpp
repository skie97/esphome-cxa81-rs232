#include "cxa81_rs232.h"
#include "esphome/core/log.h"

#include <cstdio>
#include <cstdlib>
#include <vector>
#include <string>

namespace esphome {
namespace cxa81_rs232 {

static const char *const TAG = "cxa81_rs232";

// Helper: split a line by ',' (no allocations beyond vector/strings)
static std::vector<std::string> split_csv(const std::string &s) {
  std::vector<std::string> parts;
  parts.reserve(4);
  std::string cur;
  for (char ch : s) {
    if (ch == ',') {
      parts.push_back(cur);
      cur.clear();
    } else {
      cur.push_back(ch);
    }
  }
  if (!cur.empty()) parts.push_back(cur);
  return parts;
}

void CXA81RS232::setup() {
  // Do an initial refresh shortly after boot
  this->set_timeout(600, [this]() { this->refresh_all(); });
}

void CXA81RS232::loop() {
  while (available()) {
    char c = (char) read();
    ESP_LOGI("cxa81_rs232", "RX byte: 0x%02X", c); // Debug: log all received bytes

    if (c == '\r') {
      if (!rx_.empty()) {
        handle_line_(rx_);
        rx_.clear();
      }
    } else if (c != '\n') {
      if (rx_.size() < 192) rx_.push_back(c);
      else rx_.clear();
    }
  }
}

void CXA81RS232::refresh_all() {
  send_cmd_(1, 1);   // get power
  send_cmd_(1, 3);   // get mute
  send_cmd_(3, 1);   // get source
  send_cmd_(13, 1);  // protocol version
  send_cmd_(13, 2);  // firmware version
}

void CXA81RS232::set_power(bool on) { send_cmd_(1, 2, on ? "1" : "0"); }
void CXA81RS232::set_mute(bool on) { send_cmd_(1, 4, on ? "1" : "0"); }
void CXA81RS232::source_next() { send_cmd_(3, 2); }
void CXA81RS232::source_prev() { send_cmd_(3, 3); }

void CXA81RS232::set_source_code(int code) {
  char buf[8];
  std::snprintf(buf, sizeof(buf), "%02d", code);
  send_cmd_(3, 4, buf);
}

void CXA81RS232::send_cmd_(uint8_t group, uint8_t number, const char *data) {
  char out[64];
  if (data == nullptr) std::snprintf(out, sizeof(out), "#%02u,%02u\r", group, number);
  else std::snprintf(out, sizeof(out), "#%02u,%02u,%s\r", group, number, data);

  write_str(out);
  flush();
}

void CXA81RS232::emit_(const std::vector<std::function<void(bool)>> &cbs, bool v) {
  for (auto &cb : cbs) cb(v);
}
void CXA81RS232::emit_(const std::vector<std::function<void(const std::string &)>> &cbs, const std::string &v) {
  for (auto &cb : cbs) cb(v);
}

void CXA81RS232::publish_power_(bool v) {
  power_ = v;
  emit_(on_power_, v);
  // Sync control switch (if present)
  if (power_switch_ != nullptr) power_switch_->publish_state(v);
}

void CXA81RS232::publish_mute_(bool v) {
  mute_ = v;
  emit_(on_mute_, v);
  if (mute_switch_ != nullptr) mute_switch_->publish_state(v);
}

void CXA81RS232::publish_source_from_code_(int code) {
  const char *name = "A1";
  switch (code) {
    case 0:  name = "A1"; break;
    case 1:  name = "A2"; break;
    case 2:  name = "A3"; break;
    case 3:  name = "A4"; break;
    case 4:  name = "D1"; break;
    case 5:  name = "D2"; break;
    case 6:  name = "D3"; break;
    case 14: name = "Bluetooth"; break;
    case 16: name = "USB Audio"; break;
    case 20: name = "A1 Balanced"; break;
    default: name = "A1"; break;
  }
  source_name_ = name;
  emit_(on_source_, source_name_);
  if (source_select_ != nullptr) source_select_->publish_state(source_name_);
}

void CXA81RS232::publish_proto_(const std::string &v) {
  proto_ = v;
  emit_(on_proto_, v);
}

void CXA81RS232::publish_fw_(const std::string &v) {
  fw_ = v;
  emit_(on_fw_, v);
}

void CXA81RS232::publish_error_(const std::string &v) {
  last_error_ = v;
  emit_(on_error_, v);
}

void CXA81RS232::handle_line_(const std::string &line) {
  if (line.empty() || line[0] != '#') return;

  auto parts = split_csv(line);
  if (parts.size() < 2) return;

  const int group = std::atoi(parts[0].c_str() + 1);  // skip '#'
  const int cmd   = std::atoi(parts[1].c_str());
  const std::string data = (parts.size() >= 3) ? parts[2] : "";

  // Error group
  if (group == 0) {
    publish_error_(std::string("CXA error: 00,") + std::to_string(cmd));
    return;
  }

  // Amplifier replies
  if (group == 2) {
    if (cmd == 1 && !data.empty()) publish_power_(data == "1");
    if (cmd == 3 && !data.empty()) publish_mute_(data == "1");
    return;
  }

  // Source reply
  if (group == 4 && cmd == 1 && !data.empty()) {
    publish_source_from_code_(std::atoi(data.c_str()));
    return;
  }

  // Version reply
  if (group == 14) {
    if (cmd == 1 && !data.empty()) publish_proto_(data);
    if (cmd == 2 && !data.empty()) publish_fw_(data);
    return;
  }

  ESP_LOGV(TAG, "Unhandled line: %s", line.c_str());
}

}  // namespace cxa81_rs232
}  // namespace esphome
