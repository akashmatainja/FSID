# Live OPC UA Integration Guide

> **Superseded.** Production deployments should use the edge gateway in
> [`gateway/`](gateway/README.md): machines and OPC UA node IDs are managed in the
> web app, and the gateway handles reconnects, offline buffering and secure
> OPC UA connections. `POST /opcua/ingest` described below still works, but it now
> **requires a gateway API key** (header `X-Gateway-Key`, created on the Gateways
> page) and only accepts machines from that gateway's company.
## Client Implementation Instructions

---

## Overview

This guide explains how to integrate your industrial machines with the FSID monitoring platform using OPC UA. The integration enables real-time data collection from your equipment to our cloud-based dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR INDUSTRIAL MACHINE                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              OPC UA Server (Port 4840)                      │ │
│  │  - Exposes real-time metrics (temperature, vibration, etc.) │ │
│  │  - Provides data access to authorized clients              │ │
│  └────────────────────┬───────────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────────┘
                          │ OPC UA Protocol
                          │ Encrypted & Authenticated
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              OPC UA Client (Your Deployment)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Data Collection Script (Python/Go/C++)           │ │
│  │  - Connects to machine OPC UA server                        │ │
│  │  - Reads metrics at configured intervals                     │ │
│  │  - Sends data to FSID platform via HTTP POST                │ │
│  └────────────────────┬───────────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTPS (HTTP POST)
                          │ JSON Format
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FSID PLATFORM BACKEND                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Data Ingestion Endpoint                         │ │
│  │  - Receives data via POST /opcua/ingest                     │ │
│  │  - Validates machine and company IDs                         │ │
│  │  - Stores in database for historical analysis               │ │
│  │  - Broadcasts to WebSocket for real-time dashboard           │ │
│  └────────────────────┬───────────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────────┘
                          │ WebSocket
                          │ Real-time Updates
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FSID DASHBOARD                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Web Browser (React/Next.js)                      │ │
│  │  - Displays real-time charts and KPI cards                  │ │
│  │  - Shows historical trends and analytics                    │ │
│  │  - Provides alerts and notifications                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Machine Requirements

Your industrial machine must have:
- **OPC UA Server** running and accessible
- **OPC UA Endpoint** (typically `opc.tcp://<machine-ip>:4840`)
- **Metrics exposed as OPC UA nodes** (temperature, vibration, power, etc.)
- **Network connectivity** to your OPC UA client deployment

### 2. OPC UA Client Requirements

You need to deploy an OPC UA client that:
- Can connect to your machine's OPC UA server
- Can read metric values at regular intervals
- Can send HTTP POST requests to the FSID platform
- Supports authentication (if required)

### 3. Network Requirements

- **Firewall:** Allow outbound HTTPS traffic to FSID platform
- **Bandwidth:** Minimum 1 Mbps recommended
- **Latency:** < 100ms for optimal real-time updates
- **Security:** TLS/SSL encryption for data in transit

---

## Integration Steps

### Step 1: Obtain Your Credentials

Contact FSID support to obtain:
- **Company ID** - Your unique company identifier
- **Machine ID** - Unique identifier for each machine
- **Ingestion URL** - HTTP endpoint for data submission
- **API Key** (if authentication is enabled)

Example:
```
Company ID: 643cdea7-5d4b-47da-8b3c-2ad394504b3c
Machine ID: 864cd942-4311-4299-a7b3-1c971a0f6198
Ingestion URL: https://api.fsid.com/opcua/ingest
```

### Step 2: Configure OPC UA Client

Update your OPC UA client configuration with:

```python
# Configuration
OPCUA_SERVER_URL = "opc.tcp://192.168.1.100:4840"  # Your machine's OPC UA endpoint
INGEST_URL = "https://api.fsid.com/opcua/ingest"   # FSID ingestion endpoint
MACHINE_ID = "864cd942-4311-4299-a7b3-1c971a0f6198"  # Your machine ID
COMPANY_ID = "643cdea7-5d4b-47da-8b3c-2ad394504b3c"  # Your company ID
POLL_INTERVAL = 60  # seconds - how often to read data
```

### Step 3: Map OPC UA Nodes to Metrics

Identify the OPC UA node IDs for each metric you want to collect:

```python
# Metric node mappings (Node ID → Metric Key)
METRICS = {
    "ns=2;s=Temperature": {"key": "temperature", "unit": "°C"},
    "ns=2;s=Vibration": {"key": "vibration", "unit": "mm/s"},
    "ns=2;s=Power": {"key": "power", "unit": "kW"},
    "ns=2;s=Current": {"key": "current", "unit": "A"},
    "ns=2;s=Voltage": {"key": "voltage", "unit": "V"},
    # Add more metrics as needed
}
```

**To find OPC UA node IDs:**
- Use OPC UA Explorer (UaExpert, FreeOpcUa, etc.)
- Browse your machine's OPC UA server
- Note the node IDs for relevant metrics

### Step 4: Implement Data Collection

Your OPC UA client should:

1. **Connect to OPC UA server**
2. **Read metric values** at configured intervals
3. **Format data** as JSON array
4. **Send to FSID platform** via HTTP POST

Example implementation:

```python
import asyncio
import aiohttp
from asyncua import Client
from datetime import datetime, timezone

async def read_and_send_data():
    # Connect to OPC UA server
    async with Client(url=OPCUA_SERVER_URL) as client:
        data = []
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Read each metric
        for node_id, metric_info in METRICS.items():
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
        
        # Send to FSID platform
        async with aiohttp.ClientSession() as session:
            async with session.post(INGEST_URL, json=data) as response:
                if response.status == 200:
                    print(f"Sent {len(data)} metrics successfully")
                else:
                    print(f"Error: {response.status}")

# Run continuously
while True:
    await read_and_send_data()
    await asyncio.sleep(POLL_INTERVAL)
```

### Step 5: Deploy and Monitor

1. **Deploy the OPC UA client** on your network
2. **Configure as a service** for automatic startup
3. **Monitor logs** for errors and connection issues
4. **Verify data** appears in FSID dashboard

---

## Data Format

### Request Format

Send data as JSON array via HTTP POST to `/opcua/ingest`:

```json
[
  {
    "machine_id": "864cd942-4311-4299-a7b3-1c971a0f6198",
    "company_id": "643cdea7-5d4b-47da-8b3c-2ad394504b3c",
    "metric_key": "temperature",
    "metric_value": 45.5,
    "timestamp": "2026-06-16T11:30:00Z",
    "unit": "°C",
    "source": "opcua"
  },
  {
    "machine_id": "864cd942-4311-4299-a7b3-1c971a0f6198",
    "company_id": "643cdea7-5d4b-47da-8b3c-2ad394504b3c",
    "metric_key": "vibration",
    "metric_value": 2.3,
    "timestamp": "2026-06-16T11:30:00Z",
    "unit": "mm/s",
    "source": "opcua"
  }
]
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `machine_id` | string | Yes | Your unique machine ID from FSID |
| `company_id` | string | Yes | Your unique company ID from FSID |
| `metric_key` | string | Yes | Metric identifier (e.g., "temperature", "vibration") |
| `metric_value` | number | Yes | Actual sensor reading |
| `timestamp` | string | Yes | ISO 8601 UTC timestamp (e.g., "2026-06-16T11:30:00Z") |
| `unit` | string | Yes | Unit of measurement (e.g., "°C", "kW", "A") |
| `source` | string | Yes | Data source identifier (use "opcua") |

### Response Format

**Success (200 OK):**
```json
{
  "message": "metrics ingested successfully",
  "count": 2
}
```

**Error (400 Bad Request):**
```json
{
  "error": "invalid body"
}
```

**Error (404 Not Found):**
```json
{
  "error": "machine not found"
}
```

---

## Security Considerations

### 1. Authentication

The ingestion endpoint supports authentication:
- **API Key Authentication** (recommended for production)
- **JWT Token Authentication** (if required)
- **IP Whitelisting** (additional security layer)

Contact FSID support to enable authentication for your account.

### 2. Encryption

- **HTTPS/TLS** is required for all data transmission
- **OPC UA Encryption** should be enabled on your machine
- **Certificate Management** for secure OPC UA connections

### 3. Access Control

- **Machine ID validation** ensures data goes to correct machine
- **Company ID validation** ensures data isolation
- **Rate limiting** prevents abuse

---

## Deployment Options

### Option 1: On-Premises OPC UA Client

**Architecture:**
- OPC UA client runs on your local network
- Connects to machines via local network
- Sends data to FSID platform via internet

**Benefits:**
- Secure local machine access
- No VPN required
- Client can be deployed as Docker container

**Requirements:**
- Server on your network with internet access
- Docker or Python runtime
- Network connectivity to FSID platform

### Option 2: Cloud-Based OPC UA Client

**Architecture:**
- OPC UA client runs in cloud
- Connects to machines via VPN
- Sends data to FSID platform via cloud network

**Benefits:**
- Centralized management
- Easy scaling
- No on-premises infrastructure

**Requirements:**
- VPN connection from cloud to your network
- Cloud hosting (AWS, Azure, GCP)
- VPN gateway on your network

### Option 3: Edge Device

**Architecture:**
- Small edge device (Raspberry Pi, industrial PC)
- Runs OPC UA client locally
- Sends data to FSID platform

**Benefits:**
- Low cost
- Easy deployment
- Minimal infrastructure

**Requirements:**
- Edge device with network access
- Power supply
- Basic maintenance

---

## Polling Interval Recommendations

| Use Case | Recommended Interval | Notes |
|----------|---------------------|-------|
| Real-time monitoring | 5-30 seconds | For critical metrics requiring immediate attention |
| Standard monitoring | 60 seconds | For most industrial applications |
| Historical analysis | 5-15 minutes | For trend analysis and reporting |
| Energy monitoring | 1-5 minutes | For power consumption tracking |

**Considerations:**
- Higher frequency = more data storage costs
- Network bandwidth limitations
- Machine response time
- Business requirements

---

## Troubleshooting

### Common Issues

#### 1. OPC UA Connection Failed

**Symptoms:**
- Client cannot connect to OPC UA server
- Connection timeout errors

**Solutions:**
- Verify OPC UA server is running on the machine
- Check network connectivity to the machine
- Verify OPC UA endpoint URL is correct
- Check firewall allows OPC UA port (4840)
- Verify OPC UA server authentication settings

#### 2. Data Not Appearing in Dashboard

**Symptoms:**
- OPC UA client runs successfully
- Data sent to ingestion endpoint
- No data visible in FSID dashboard

**Solutions:**
- Verify machine ID and company ID are correct
- Check ingestion endpoint URL is correct
- Verify HTTP response is 200 OK
- Check FSID dashboard date range (default shows last 15 minutes)
- Verify metric keys match expected format

#### 3. Authentication Errors

**Symptoms:**
- 401 Unauthorized or 403 Forbidden responses
- API key validation errors

**Solutions:**
- Verify API key is correct
- Check API key is not expired
- Contact FSID support if authentication is not enabled

#### 4. Network Issues

**Symptoms:**
- Intermittent connection failures
- Slow data transmission
- Timeout errors

**Solutions:**
- Check network stability
- Verify internet connectivity
- Check firewall settings
- Monitor network latency
- Consider retry logic in client

### Diagnostic Tools

**OPC UA Client:**
- OPC UA Explorer (browse OPC UA nodes)
- Wireshark (network packet analysis)
- Client logs (error tracking)

**FSID Platform:**
- Dashboard status indicators
- API response codes
- Contact FSID support for backend logs

---

## Example Implementations

### Python Implementation

See the provided example script in the demo package:
- `opcua_local_demo/opcua_client.py`

### Go Implementation

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "time"
    
    "github.com/gopcua/opcua"
)

type Metric struct {
    MachineID   string  `json:"machine_id"`
    CompanyID   string  `json:"company_id"`
    MetricKey   string  `json:"metric_key"`
    MetricValue float64 `json:"metric_value"`
    Timestamp   string  `json:"timestamp"`
    Unit        string  `json:"unit"`
    Source      string  `json:"source"`
}

func sendMetrics(metrics []Metric) error {
    data, _ := json.Marshal(metrics)
    resp, err := http.Post(
        "https://api.fsid.com/opcua/ingest",
        "application/json",
        bytes.NewBuffer(data),
    )
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    return nil
}
```

### C# Implementation

```csharp
using System;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;

public class Metric
{
    public string machine_id { get; set; }
    public string company_id { get; set; }
    public string metric_key { get; set; }
    public double metric_value { get; set; }
    public string timestamp { get; set; }
    public string unit { get; set; }
    public string source { get; set; }
}

public async Task SendMetrics(Metric[] metrics)
{
    var client = new HttpClient();
    var json = JsonConvert.SerializeObject(metrics);
    var content = new StringContent(json, Encoding.UTF8, "application/json");
    
    var response = await client.PostAsync(
        "https://api.fsid.com/opcua/ingest",
        content
    );
    
    response.EnsureSuccessStatusCode();
}
```

---

## Testing Your Integration

### 1. Local Testing

Use the provided demo setup to test locally:
- Run OPC UA server simulator
- Run OPC UA client with your configuration
- Verify data appears in dashboard

### 2. Staging Testing

Test with staging environment:
- Use staging ingestion URL
- Verify with test machine ID
- Check data in staging dashboard

### 3. Production Deployment

Deploy to production:
- Update to production ingestion URL
- Use production machine/company IDs
- Monitor for errors
- Verify data in production dashboard

---

## Monitoring and Maintenance

### Health Monitoring

**Monitor:**
- OPC UA client connection status
- Data transmission success rate
- Error logs and alerts
- Data quality and accuracy

**Alerts:**
- Connection failures
- Data transmission errors
- Missing data points
- Anomalous values

### Maintenance Tasks

**Regular:**
- Monitor OPC UA client logs
- Check data transmission rates
- Review error logs
- Verify data accuracy

**Periodic:**
- Update OPC UA client software
- Review security certificates
- Optimize polling intervals
- Clean up historical data

---

## Support

### Contact Information

- **Email:** support@fsid.com
- **Phone:** +1-XXX-XXX-XXXX
- **Documentation:** https://docs.fsid.com
- **Status Page:** https://status.fsid.com

### Support Process

1. **Issue Report:** Submit issue with details
2. **Initial Response:** Within 24 hours
3. **Investigation:** Technical team reviews
4. **Resolution:** Fix or workaround provided
5. **Follow-up:** Verify issue resolved

### SLA

- **Critical Issues:** 4-hour response time
- **High Priority:** 8-hour response time
- **Medium Priority:** 24-hour response time
- **Low Priority:** 48-hour response time

---

## Appendix

### A. Glossary

- **OPC UA:** Open Platform Communications Unified Architecture - industrial communication protocol
- **Node:** OPC UA data point representing a metric or property
- **Namespace:** OPC UA namespace for organizing nodes
- **Polling:** Client requests data at regular intervals
- **Subscription:** Server pushes data when values change
- **Ingestion:** Process of receiving and storing data
- **WebSocket:** Real-time bidirectional communication protocol

### B. Metric Key Naming Convention

Use lowercase with underscores:
- `temperature` - Temperature readings
- `vibration` - Vibration measurements
- `power` - Power consumption
- `current` - Electrical current
- `voltage` - Voltage readings
- `pressure` - Pressure measurements
- `rpm` - Rotational speed
- `flow_rate` - Flow rate measurements

### C. Unit Standards

Use standard SI units:
- Temperature: °C (Celsius) or K (Kelvin)
- Power: kW (kilowatts) or W (watts)
- Current: A (amperes)
- Voltage: V (volts)
- Pressure: bar, Pa (pascals), or psi
- Speed: RPM (revolutions per minute)
- Flow: L/min (liters per minute) or m³/h

---

**Document Version:** 1.0  
**Last Updated:** June 16, 2026  
**Contact:** support@fsid.com
