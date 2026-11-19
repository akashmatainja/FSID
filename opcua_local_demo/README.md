# OPC UA Local Demo Setup
## Test OPC UA Data Flow on Localhost

This guide explains how to set up and test OPC UA data flow locally using the provided simulator scripts.

---

## Prerequisites

### 1. Python Installation
- Python 3.8 or higher
- pip package manager

### 2. Required Python Packages
```bash
pip install asyncua websockets
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         OPC UA Server Simulator (opcua_server.py)       │
│  - Runs on localhost:4840                               │
│  - Exposes demo metrics (temperature, vibration, etc.)  │
│  - Updates values every 5 seconds                       │
└────────────────────┬────────────────────────────────────┘
                     │ OPC UA Protocol
                     ▼
┌─────────────────────────────────────────────────────────┐
│         OPC UA Client (opcua_client.py)                  │
│  - Connects to OPC UA server                             │
│  - Reads metrics every 60 seconds                        │
│  - Sends data to backend WebSocket                       │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Backend Server (Go)                              │
│  - Running on localhost:8080                             │
│  - Receives data via WebSocket                           │
│  - Broadcasts to frontend                                │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Frontend Dashboard (Next.js)                      │
│  - Running on localhost:3000                             │
│  - Displays real-time data                               │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup

### Step 1: Start Backend Server

Open a terminal in the backend directory:

```bash
cd backend
go run .
```

The backend will start on `http://localhost:8080`

**Expected Output:**
```
2026/06/15 10:00:00 Database connected
2026/06/15 10:00:00 Server starting on :8080
...
```

---

### Step 2: Start Frontend Server

Open a new terminal in the frontend directory:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

**Expected Output:**
```
▲ Next.js 14.2.5
- Local: http://localhost:3000
✓ Ready in 5s
```

---

### Step 3: Start OPC UA Server Simulator

Open a new terminal in the opcua_local_demo directory:

```bash
cd opcua_local_demo
python opcua_server.py
```

The OPC UA server will start on `opc.tcp://localhost:4840`

**Expected Output:**
```
INFO:__main__:OPC UA Server setup complete with 9 metric nodes
INFO:__main__:OPC UA Server started at opc.tcp://localhost:4840
INFO:__main__:You can connect with OPC UA clients to read demo data
INFO:__main__:Updated values at 10:00:05
INFO:__main__:Updated values at 10:00:10
...
```

---

### Step 4: Configure OPC UA Client

Before running the client, update the configuration in `opcua_client.py`:

```python
# Configuration
OPCUA_SERVER_URL = "opc.tcp://localhost:4840"
WEBSOCKET_URL = "ws://localhost:8080/ws?machine_id=all"
MACHINE_ID = "b73b49b0-c607-47af-badc-5c3f62a058ea"  # Replace with your machine ID
COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Replace with your company ID
POLL_INTERVAL = 60  # seconds
```

**To get your Machine ID:**
1. Login to the dashboard at `http://localhost:3000`
2. Navigate to Machines page
3. Click on a machine to view details
4. Copy the machine ID from the URL or database

---

### Step 5: Start OPC UA Client

Open a new terminal in the opcua_local_demo directory:

```bash
cd opcua_local_demo
python opcua_client.py
```

The client will start reading data and sending to the backend.

**Expected Output:**
```
INFO:__main__:Starting OPC UA Client for local testing
INFO:__main__:OPC UA Server: opc.tcp://localhost:4840
INFO:__main__:WebSocket URL: ws://localhost:8080/ws?machine_id=all
INFO:__main__:Poll Interval: 60 seconds
INFO:__main__:Connected to OPC UA server at opc.tcp://localhost:4840
INFO:__main__:Read temperature: 42.5 °C
INFO:__main__:Read vibration: 2.3 mm/s
INFO:__main__:Read energy_kwh: 150.1 kWh
...
INFO:__main__:Sent 9 metrics to backend
INFO:__main__:Server response: OK
INFO:__main__:Waiting 60 seconds before next poll...
```

---

### Step 6: View Data in Dashboard

1. Open browser and navigate to `http://localhost:3000`
2. Login with sample credentials
3. Navigate to Dashboard
4. You should see:
   - Live connection indicator (green "Live" badge)
   - Real-time chart updates
   - KPI cards showing latest values

---

## Available Metrics

The OPC UA server simulator exposes the following metrics:

| Metric Key | Node ID | Unit | Range |
|------------|---------|------|-------|
| temperature | ns=2;s=Temperature | °C | 40-50 |
| vibration | ns=2;s=Vibration | mm/s | 1.5-3.5 |
| energy_kwh | ns=2;s=Energy_kWh | kWh | Increments |
| power_kw | ns=2;s=Power_kW | kW | 10-15 |
| current_a | ns=2;s=Current_A | A | 15-22 |
| voltage_v | ns=2;s=Voltage_V | V | 400-430 |
| pressure_bar | ns=2;s=Pressure_bar | bar | 2.0-3.0 |
| rpm | ns=2;s=RPM | RPM | 1400-1500 |
| flow_rate | ns=2;s=FlowRate_Lmin | L/min | 45-55 |

---

## Troubleshooting

### OPC UA Server Won't Start

**Problem:** Port 4840 already in use
```bash
# Check if port is in use (Windows)
netstat -ano | findstr :4840

# Kill the process if needed
taskkill /PID <PID> /F
```

**Problem:** Python packages not installed
```bash
pip install async-opcua websockets
```

### OPC UA Client Can't Connect

**Problem:** OPC UA server not running
- Ensure `opcua_server.py` is running
- Check the terminal for error messages

**Problem:** Backend WebSocket not accessible
- Ensure backend is running on `localhost:8080`
- Check backend terminal for WebSocket connection logs

### Data Not Appearing in Dashboard

**Problem:** Machine ID doesn't match database
- Verify MACHINE_ID in `opcua_client.py` matches your database
- Check the backend logs for machine ID validation errors

**Problem:** WebSocket connection failed
- Check backend logs for WebSocket errors
- Verify WEBSOCKET_URL is correct
- Ensure backend is running

### Browser Cookie Issue

**Problem:** "Request Header Fields Too Large" error
- Clear browser cookies for localhost
- Or use incognito/private mode

---

## Testing with OPC UA Explorer

You can use an OPC UA client tool to explore the server:

### Using UaExpert (Windows)
1. Download UaExpert from Unified Automation
2. Add new server: `opc.tcp://localhost:4840`
3. Connect and browse the nodes
4. View real-time values

### Using Python Script
```python
from asyncua import Client
import asyncio

async def browse_server():
    async with Client(url="opc.tcp://localhost:4840") as client:
        # Get root node
        root = client.get_root_node()
        
        # Browse objects
        objects = client.get_objects_node()
        print(f"Objects: {objects}")
        
        # Read temperature
        temp_node = client.get_node("ns=2;s=Temperature")
        temp = await temp_node.read_value()
        print(f"Temperature: {temp}°C")

asyncio.run(browse_server())
```

---

## Customization

### Change Poll Interval

Edit `opcua_client.py`:
```python
POLL_INTERVAL = 30  # Change to 30 seconds for faster updates
```

### Add New Metrics

Edit `opcua_server.py` to add new nodes:
```python
# Add new metric
new_node = await machine.add_variable(idx, "NewMetric", 0.0)
await new_node.set_writable()
self.nodes['new_metric'] = new_node
```

Edit `opcua_client.py` to read the new metric:
```python
METRICS = {
    # ... existing metrics
    "ns=2;s=NewMetric": {"key": "new_metric", "unit": "unit"},
}
```

### Change Value Ranges

Edit `opcua_server.py` in the `update_values` method:
```python
# Example: Change temperature range
temp = 30 + random.uniform(-10, 10)  # Now 20-40°C
```

---

## Production Considerations

This demo setup is for testing only. For production:

1. **Security:**
   - Use TLS/SSL encryption
   - Implement authentication
   - Use X.509 certificates

2. **Reliability:**
   - Deploy as system service
   - Add error handling and retry logic
   - Implement health monitoring

3. **Performance:**
   - Use subscription instead of polling for faster updates
   - Optimize data transmission
   - Add data compression if needed

---

## Summary

The local demo setup consists of:

1. **OPC UA Server Simulator** - Exposes demo metrics on localhost:4840
2. **OPC UA Client** - Reads metrics and sends to backend WebSocket
3. **Backend Server** - Receives and broadcasts data
4. **Frontend Dashboard** - Displays real-time data

This allows you to test the complete OPC UA data flow without actual industrial equipment.

---

**For questions or issues, refer to the main documentation or contact support.**
