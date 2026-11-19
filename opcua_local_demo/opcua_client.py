"""
OPC UA Client for Local Testing
This script reads data from the OPC UA server and sends to backend via HTTP
"""

import asyncio
import json
import aiohttp
import os
from asyncua import Client
from datetime import datetime, timezone
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
OPCUA_SERVER_URL = "opc.tcp://146.196.46.162:4840/abhipsita/abexon"
INGEST_URL = "http://localhost:8080/opcua/ingest"
# /opcua/ingest now requires a gateway API key (Gateways page in the web app).
# For production use the edge gateway in gateway/ instead of this script.
GATEWAY_KEY = os.environ.get("FSID_GATEWAY_KEY", "")
MACHINE_ID = "864cd942-4311-4299-a7b3-1c971a0f6198"  # Replace with your machine ID
COMPANY_ID = "643cdea7-5d4b-47da-8b3c-2ad394504b3c"  # Replace with your company ID
POLL_INTERVAL = 1  # seconds

# Metric node mappings (Node ID → Metric Key)
# ABExON server: channel "value" nodes (ns=2;i=2003 + 5*ch)
METRICS = {
    "ns=2;i=2003": {"key": "temperature", "unit": "°C"},       # Ch-00
    "ns=2;i=2008": {"key": "humidity", "unit": "%"},           # Ch-01
    "ns=2;i=2013": {"key": "pressure", "unit": "bar"},         # Ch-02
    "ns=2;i=2018": {"key": "co2", "unit": "ppm"},              # Ch-03
    "ns=2;i=2023": {"key": "power", "unit": "kW"},             # Ch-04
    "ns=2;i=2028": {"key": "energy", "unit": "kWh"},           # Ch-05
    "ns=2;i=2033": {"key": "voltage", "unit": "V"},            # Ch-06
    "ns=2;i=2038": {"key": "current", "unit": "A"},            # Ch-07
    "ns=2;i=2043": {"key": "power_factor", "unit": "PF"},      # Ch-08
}

# Need to install aiohttp: pip install aiohttp

async def read_opcua_data():
    """Read data from OPC UA server"""
    try:
        async with Client(url=OPCUA_SERVER_URL) as client:
            logger.info(f"Connected to OPC UA server at {OPCUA_SERVER_URL}")
            
            data = []
            timestamp = datetime.now(timezone.utc).isoformat()
            
            for node_id, metric_info in METRICS.items():
                try:
                    node = client.get_node(node_id)
                    value = await node.read_value()
                    
                    data.append({
                        "machine_id": MACHINE_ID,
                        "company_id": COMPANY_ID,
                        "metric_key": metric_info["key"],
                        "metric_value": value,
                        "timestamp": timestamp,
                        "unit": metric_info["unit"],
                        "source": "opcua"
                    })
                    
                    logger.info(f"Read {metric_info['key']}: {value} {metric_info['unit']}")
                    
                except Exception as e:
                    logger.error(f"Error reading {node_id}: {e}")
            
            return data
            
    except Exception as e:
        logger.error(f"Error connecting to OPC UA server: {e}")
        return []

async def send_to_backend(data):
    """Send data to backend via HTTP POST"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(INGEST_URL, json=data, headers={"X-Gateway-Key": GATEWAY_KEY}) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"Sent {len(data)} metrics to backend: {result}")
                else:
                    error = await response.text()
                    logger.error(f"Error sending to backend: {response.status} - {error}")
    except Exception as e:
        logger.error(f"Error sending to backend: {e}")

async def main():
    """Main loop"""
    logger.info("Starting OPC UA Client for local testing")
    logger.info(f"OPC UA Server: {OPCUA_SERVER_URL}")
    logger.info(f"Ingest URL: {INGEST_URL}")
    logger.info(f"Poll Interval: {POLL_INTERVAL} seconds")
    
    while True:
        try:
            # Read data from OPC UA server
            data = await read_opcua_data()
            
            if data:
                # Send to backend
                await send_to_backend(data)
            
            # Wait before next poll
            logger.info(f"Waiting {POLL_INTERVAL} seconds before next poll...")
            await asyncio.sleep(POLL_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("Shutting down client...")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            await asyncio.sleep(5)  # Wait before retrying

if __name__ == "__main__":
    asyncio.run(main())
