# Energy Monitoring Module

## Overview
The Energy Monitoring Module provides comprehensive real-time tracking and analysis of energy consumption across industrial machines and equipment. It enables organizations to optimize energy usage, reduce costs, and identify inefficiencies.

## Features

### Real-Time Energy Metrics
- **Voltage Monitoring**: Track voltage levels (V) across phases
- **Current Measurement**: Monitor current draw (A) in real-time
- **Power Consumption**: Track active power usage (kW)
- **Energy Accumulation**: Cumulative energy consumption (kWh)
- **Power Factor**: Monitor power factor efficiency
- **Frequency Tracking**: Grid frequency monitoring (Hz)

### Data Visualization
- Real-time charts showing energy trends
- Historical data analysis with customizable time ranges
- Comparative analysis across machines
- Energy consumption patterns and anomalies

### Alerting & Notifications
- Threshold-based alerts for abnormal consumption
- Power quality notifications
- Equipment efficiency warnings
- Customizable alert rules

## Current Status
✅ **Implemented**
- Database schema for energy metrics
- Real-time data ingestion via OPC UA
- WebSocket-based live updates
- Historical data storage and retrieval
- Frontend dashboard with charts
- Machine-level energy assignment

## Implementation Progress

### Backend
- ✅ Energy metrics defined in Module configuration
- ✅ OPC UA client integration for real-time data
- ✅ WebSocket hub for live data broadcasting
- ✅ Database storage for historical data
- ✅ API endpoints for data retrieval

### Frontend
- ✅ Energy module card in machine details
- ✅ Real-time energy charts with Recharts
- ✅ Time range selection (15m, 1h, 24h, 7d)
- ✅ Live OPC UA indicator
- ✅ Responsive design

### Integration
- ✅ Module assignment to machines
- ✅ Metric configuration and management
- ✅ Cross-machine energy comparison
- ✅ Export functionality (planned)

## Technical Details

### Data Sources
- **Primary**: OPC UA server integration
- **Fallback**: Historical database queries
- **Polling Interval**: 5 seconds for live data

### Metrics Tracked
| Metric | Code | Unit | Description |
|--------|------|------|-------------|
| Voltage | voltage | V | Electrical voltage level |
| Current | current | A | Electrical current flow |
| Power | power | kW | Active power consumption |
| Energy | energy | kWh | Cumulative energy usage |
| Power Factor | power_factor | - | Ratio of real to apparent power |
| Frequency | frequency | Hz | Grid frequency |

### API Endpoints
- `GET /api/v1/machines/:id/stats` - Retrieve energy statistics
- `GET /api/v1/modules/active` - List active modules
- `POST /api/v1/machines/:id/modules` - Assign energy module

## Next Steps

### Phase 1 (Completed)
- [x] Basic energy monitoring
- [x] Real-time data visualization
- [x] Historical data storage

### Phase 2 (In Progress)
- [ ] Energy cost calculation
- [ ] Peak demand analysis
- [ ] Energy efficiency scoring
- [ ] Automated reporting

### Phase 3 (Planned)
- [ ] Predictive energy forecasting
- [ ] Load balancing recommendations
- [ ] Renewable energy integration
- [ ] Carbon footprint tracking

## Client Requirements

### Hardware
- Energy meters with OPC UA support
- Network connectivity to meters
- Compatible OPC UA server

### Software
- OPC UA server configured with energy nodes
- Proper node IDs mapped in system
- Authentication credentials (if required)

### Configuration
- Assign Energy module to relevant machines
- Configure metric node IDs
- Set alert thresholds
- Define reporting schedules

## Support & Maintenance
- Real-time monitoring dashboard
- Automated data backup
- System health checks
- Regular performance optimization

---

**Last Updated**: July 23, 2026
**Version**: 1.0.0
**Status**: Production Ready
