"""
OPC UA Server Simulator for Local Testing
This script creates a simple OPC UA server that exposes demo metrics
"""

import asyncio
import logging
from asyncua import Server, ua
from datetime import datetime
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OPCUAServerSimulator:
    def __init__(self, host="0.0.0.0", port=4840):
        self.server = Server()
        self.host = host
        self.port = port
        self.url = f"opc.tcp://{host}:{port}"
        self.running = False
        
    async def setup_server(self):
        """Setup OPC UA server with demo nodes"""
        await self.server.init()
        self.server.set_endpoint(self.url)
        self.server.set_server_name("FSID Demo OPC UA Server")
        
        # Setup security (no security for demo - use certificates in production)
        self.server.set_security_policy([ua.SecurityPolicyType.NoSecurity])
        
        # Register namespace
        idx = await self.server.register_namespace("http://fsid.demo/machine")
        
        # Get Objects node
        objects = self.server.get_objects_node()
        
        # Add Machine object
        machine = await objects.add_object(idx, "Machine")
        
        # Add metric nodes with string IDs
        self.nodes = {}
        
        # Temperature
        temp_node = await machine.add_variable(ua.NodeId("Temperature", idx), "Temperature", 45.0)
        await temp_node.set_writable()
        self.nodes['temperature'] = temp_node
        
        # Vibration
        vib_node = await machine.add_variable(ua.NodeId("Vibration", idx), "Vibration", 2.5)
        await vib_node.set_writable()
        self.nodes['vibration'] = vib_node
        
        # Energy (kWh)
        energy_node = await machine.add_variable(ua.NodeId("Energy_kWh", idx), "Energy_kWh", 150.0)
        await energy_node.set_writable()
        self.nodes['energy_kwh'] = energy_node
        
        # Power (kW)
        power_node = await machine.add_variable(ua.NodeId("Power_kW", idx), "Power_kW", 12.5)
        await power_node.set_writable()
        self.nodes['power_kw'] = power_node
        
        # Current (A)
        current_node = await machine.add_variable(ua.NodeId("Current_A", idx), "Current_A", 18.5)
        await current_node.set_writable()
        self.nodes['current_a'] = current_node
        
        # Voltage (V)
        voltage_node = await machine.add_variable(ua.NodeId("Voltage_V", idx), "Voltage_V", 415.0)
        await voltage_node.set_writable()
        self.nodes['voltage_v'] = voltage_node
        
        # Pressure (bar)
        pressure_node = await machine.add_variable(ua.NodeId("Pressure_bar", idx), "Pressure_bar", 2.5)
        await pressure_node.set_writable()
        self.nodes['pressure_bar'] = pressure_node
        
        # RPM
        rpm_node = await machine.add_variable(ua.NodeId("RPM", idx), "RPM", 1450.0)
        await rpm_node.set_writable()
        self.nodes['rpm'] = rpm_node
        
        # Flow Rate (L/min)
        flow_node = await machine.add_variable(ua.NodeId("FlowRate_Lmin", idx), "FlowRate_Lmin", 50.0)
        await flow_node.set_writable()
        self.nodes['flow_rate'] = flow_node
        
        # Print node IDs for debugging
        logger.info("Node IDs created:")
        for key, node in self.nodes.items():
            logger.info(f"  {key}: {node.nodeid}")
        
        logger.info(f"OPC UA Server setup complete with {len(self.nodes)} metric nodes")
        
    async def update_values(self):
        """Simulate changing values"""
        while self.running:
            # Temperature: 40-50°C with small fluctuations
            temp = 45 + random.uniform(-5, 5)
            await self.nodes['temperature'].write_value(round(temp, 2))
            
            # Vibration: 1.5-3.5 mm/s
            vib = 2.5 + random.uniform(-1, 1)
            await self.nodes['vibration'].write_value(round(vib, 2))
            
            # Energy: Increment slowly
            energy = await self.nodes['energy_kwh'].read_value()
            await self.nodes['energy_kwh'].write_value(round(energy + 0.1, 2))
            
            # Power: 10-15 kW
            power = 12.5 + random.uniform(-2.5, 2.5)
            await self.nodes['power_kw'].write_value(round(power, 2))
            
            # Current: 15-22 A
            current = 18.5 + random.uniform(-3.5, 3.5)
            await self.nodes['current_a'].write_value(round(current, 2))
            
            # Voltage: 400-430 V
            voltage = 415 + random.uniform(-15, 15)
            await self.nodes['voltage_v'].write_value(round(voltage, 2))
            
            # Pressure: 2.0-3.0 bar
            pressure = 2.5 + random.uniform(-0.5, 0.5)
            await self.nodes['pressure_bar'].write_value(round(pressure, 2))
            
            # RPM: 1400-1500
            rpm = 1450 + random.uniform(-50, 50)
            await self.nodes['rpm'].write_value(round(rpm, 2))
            
            # Flow Rate: 45-55 L/min
            flow = 50 + random.uniform(-5, 5)
            await self.nodes['flow_rate'].write_value(round(flow, 2))
            
            logger.info(f"Updated values at {datetime.now().strftime('%H:%M:%S')}")
            await asyncio.sleep(5)  # Update every 5 seconds
    
    async def start(self):
        """Start the OPC UA server"""
        await self.setup_server()
        self.running = True
        
        async with self.server:
            logger.info(f"OPC UA Server started at {self.url}")
            logger.info("You can connect with OPC UA clients to read demo data")
            
            # Start value updates
            update_task = asyncio.create_task(self.update_values())
            
            try:
                # Keep server running
                while self.running:
                    await asyncio.sleep(1)
            except KeyboardInterrupt:
                logger.info("Shutting down server...")
                self.running = False
                update_task.cancel()
                try:
                    await update_task
                except asyncio.CancelledError:
                    pass

async def main():
    server = OPCUAServerSimulator()
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
