import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import text_sensor
from esphome.const import CONF_ID

from . import CXA81RS232

CONF_PROTOCOL_VERSION = "protocol_version"
CONF_FIRMWARE_VERSION = "firmware_version"
CONF_CURRENT_SOURCE = "current_source"
CONF_LAST_ERROR = "last_error"

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(CONF_ID): cv.use_id(CXA81RS232),
        cv.Optional(CONF_PROTOCOL_VERSION): text_sensor.text_sensor_schema(),
        cv.Optional(CONF_FIRMWARE_VERSION): text_sensor.text_sensor_schema(),
        cv.Optional(CONF_CURRENT_SOURCE): text_sensor.text_sensor_schema(),
        cv.Optional(CONF_LAST_ERROR): text_sensor.text_sensor_schema(),
    }
)

async def to_code(config):
    hub = await cg.get_variable(config[CONF_ID])

    if CONF_PROTOCOL_VERSION in config:
        ts = await text_sensor.new_text_sensor(config[CONF_PROTOCOL_VERSION])
        cg.add(hub.add_on_proto(cg.RawExpression(
            f"[=](const std::string &s) {{ {ts}->publish_state(s); }}"
        )))

    if CONF_FIRMWARE_VERSION in config:
        ts = await text_sensor.new_text_sensor(config[CONF_FIRMWARE_VERSION])
        cg.add(hub.add_on_fw(cg.RawExpression(
            f"[=](const std::string &s) {{ {ts}->publish_state(s); }}"
        )))

    if CONF_CURRENT_SOURCE in config:
        ts = await text_sensor.new_text_sensor(config[CONF_CURRENT_SOURCE])
        cg.add(hub.add_on_source(cg.RawExpression(
            f"[=](const std::string &s) {{ {ts}->publish_state(s); }}"
        )))

    if CONF_LAST_ERROR in config:
        ts = await text_sensor.new_text_sensor(config[CONF_LAST_ERROR])
        cg.add(hub.add_on_error(cg.RawExpression(
            f"[=](const std::string &s) {{ {ts}->publish_state(s); }}"
        )))
