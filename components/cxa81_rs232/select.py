import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import select
from esphome.const import CONF_ID

from . import cxa_ns, CXA81RS232

CONF_SOURCE = "source"

CXA81SourceSelect = cxa_ns.class_("CXA81SourceSelect", select.Select)

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(CONF_ID): cv.use_id(CXA81RS232),
        cv.Optional(CONF_SOURCE): select.select_schema(CXA81SourceSelect),
    }
)

async def to_code(config):
    hub = await cg.get_variable(config[CONF_ID])

    if CONF_SOURCE in config:
        sel = await select.new_select(config[CONF_SOURCE])
        cg.add(sel.set_parent(hub))
        cg.add(hub.set_source_select(sel))
