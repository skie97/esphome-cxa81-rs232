import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import switch
from esphome.const import CONF_ID

from . import cxa_ns, CXA81RS232

CONF_POWER = "power"
CONF_MUTE = "mute"

CXA81PowerSwitch = cxa_ns.class_("CXA81PowerSwitch", switch.Switch)
CXA81MuteSwitch  = cxa_ns.class_("CXA81MuteSwitch", switch.Switch)

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(CONF_ID): cv.use_id(CXA81RS232),
        cv.Optional(CONF_POWER): switch.switch_schema(CXA81PowerSwitch),
        cv.Optional(CONF_MUTE): switch.switch_schema(CXA81MuteSwitch),
    }
)

async def to_code(config):
    hub = await cg.get_variable(config[CONF_ID])

    if CONF_POWER in config:
        sw = await switch.new_switch(config[CONF_POWER])
        cg.add(sw.set_parent(hub))
        cg.add(hub.set_power_switch(sw))

    if CONF_MUTE in config:
        sw = await switch.new_switch(config[CONF_MUTE])
        cg.add(sw.set_parent(hub))
        cg.add(hub.set_mute_switch(sw))
