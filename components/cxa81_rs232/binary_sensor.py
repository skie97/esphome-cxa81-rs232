import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import binary_sensor
from esphome.const import CONF_ID

from . import CXA81RS232

CONF_POWER = "power"
CONF_MUTE = "mute"

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(CONF_ID): cv.use_id(CXA81RS232),
        cv.Optional(CONF_POWER): binary_sensor.binary_sensor_schema(),
        cv.Optional(CONF_MUTE): binary_sensor.binary_sensor_schema(),
    }
)

async def to_code(config):
    hub = await cg.get_variable(config[CONF_ID])

    if CONF_POWER in config:
        bs = await binary_sensor.new_binary_sensor(config[CONF_POWER])
        cg.add(hub.add_on_power(cg.RawExpression(
            f"[=](bool v) {{ {bs}->publish_state(v); }}"
        )))

    if CONF_MUTE in config:
        bs = await binary_sensor.new_binary_sensor(config[CONF_MUTE])
        cg.add(hub.add_on_mute(cg.RawExpression(
            f"[=](bool v) {{ {bs}->publish_state(v); }}"
        )))
