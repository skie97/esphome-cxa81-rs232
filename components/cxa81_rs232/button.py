import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import button
from esphome.const import CONF_ID

from . import cxa_ns, CXA81RS232

CONF_SOURCE_NEXT = "source_next"
CONF_SOURCE_PREV = "source_prev"
CONF_REFRESH     = "refresh"

CXA81SimpleButton = cxa_ns.class_("CXA81SimpleButton", button.Button)

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(CONF_ID): cv.use_id(CXA81RS232),
        cv.Optional(CONF_SOURCE_NEXT): button.button_schema(CXA81SimpleButton),
        cv.Optional(CONF_SOURCE_PREV): button.button_schema(CXA81SimpleButton),
        cv.Optional(CONF_REFRESH): button.button_schema(CXA81SimpleButton),
    }
)

async def to_code(config):
    hub = await cg.get_variable(config[CONF_ID])

    if CONF_SOURCE_NEXT in config:
        b = await button.new_button(config[CONF_SOURCE_NEXT])
        cg.add(b.set_parent(hub))
        cg.add(b.set_kind(1))
        cg.add(hub.set_btn_next(b))

    if CONF_SOURCE_PREV in config:
        b = await button.new_button(config[CONF_SOURCE_PREV])
        cg.add(b.set_parent(hub))
        cg.add(b.set_kind(2))
        cg.add(hub.set_btn_prev(b))

    if CONF_REFRESH in config:
        b = await button.new_button(config[CONF_REFRESH])
        cg.add(b.set_parent(hub))
        cg.add(b.set_kind(3))
        cg.add(hub.set_btn_refresh(b))
