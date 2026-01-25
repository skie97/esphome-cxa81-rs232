import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import uart
from esphome.const import CONF_ID, CONF_UART_ID

CODEOWNERS = ["@skie97"]
DEPENDENCIES = ["uart"]

cxa_ns = cg.esphome_ns.namespace("cxa81_rs232")
CXA81RS232 = cxa_ns.class_("CXA81RS232", cg.Component, uart.UARTDevice)

CONF_CXA81_RS232_ID = "cxa81_rs232_id"

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(): cv.declare_id(CXA81RS232),
        cv.Required(CONF_UART_ID): cv.use_id(uart.UARTComponent),
    }
).extend(cv.COMPONENT_SCHEMA)

async def to_code(config):
    uart_comp = await cg.get_variable(config[CONF_UART_ID])   # ✅ resolve ID -> variable
    var = cg.new_Pvariable(config[CONF_ID], uart_comp)        # ✅ pass actual UART component
    await cg.register_component(var, config)
    await uart.register_uart_device(var, config)              # ✅ important for UARTDevice
