# Expert Guided Remote Maintenance Module

## Overview
The Expert Guided Remote Maintenance Module enables remote experts to guide on-site technicians through complex maintenance procedures using real-time video collaboration, augmented reality (AR) assistance, and interactive communication tools. This reduces travel costs, improves first-time fix rates, and accelerates problem resolution.

## Features

### Remote Video Collaboration
- **Live Video Streaming**: Real-time video from technician's device
- **Two-Way Audio**: Voice communication between expert and technician
- **Screen Sharing**: Share diagrams, manuals, and schematics
- **Annotation Tools**: Draw and highlight on video feed
- **Session Recording**: Record maintenance sessions for training

### Augmented Reality Assistance
- **AR Overlays**: Display 3D models and instructions on real equipment
- **Part Identification**: Automatically identify components via camera
- **Step-by-Step Guidance**: Visual AR instructions for procedures
- **Measurement Tools**: AR-based distance and angle measurements
- **Document Overlay**: Display manuals and schematics in AR view

### PTZ Camera Control
- **Remote Camera Access**: Control PTZ cameras on equipment
- **Pan/Tilt/Zoom**: Adjust camera view remotely
- **Preset Management**: Save and recall camera positions
- **Multi-Camera Support**: Switch between multiple camera feeds
- **Recording Integration**: Record camera feeds during sessions

### Session Management
- **Expert Scheduling**: Book expert availability
- **Session Queue**: Manage multiple maintenance requests
- **Priority Handling**: Emergency session escalation
- **Session History**: Track all maintenance sessions
- **Performance Metrics**: Measure session effectiveness

## Current Status
✅ **Implemented**
- Database schema for remote maintenance
- WebRTC-based video streaming
- PTZ camera control interface
- Room-based signaling system
- WebSocket real-time communication
- TURN/STUN server configuration for NAT traversal
- Canvas-based PTZ simulation
- Frontend camera page (Laptop A)
- Frontend viewer/control page (Laptop B)
- Remote Camera sidebar integration

## Implementation Progress

### Backend
- ✅ WebRTC ICE server configuration
- ✅ Room-based signaling WebSocket hub
- ✅ PTZ command handling
- ✅ Video stream management
- ✅ TURN/STUN server integration
- ✅ OPC UA client for camera data (configurable)
- ✅ API endpoints for session management

### Frontend
- ✅ Public camera page with webcam capture
- ✅ Canvas-based PTZ simulation
- ✅ WebRTC streaming integration
- ✅ Viewer page with live video
- ✅ PTZ control interface (pan, tilt, zoom)
- ✅ Preset management
- ✅ Mute and fullscreen controls
- ✅ Room code generation
- ✅ Signaling client library
- ✅ ICE helper functions

### Integration
- ✅ Module assignment to machines
- ✅ Cross-network video support via TURN
- ✅ Local network testing support
- ✅ Remote camera sidebar menu
- ✅ Mobile responsive design

## Technical Details

### Video Streaming Architecture
```
[Camera/Technician Device] --WebRTC--> [Backend Signaling] --WebRTC--> [Expert Device]
                           <--Signaling--                <--Signaling--
```

### Data Sources
- **Primary**: WebRTC peer-to-peer video streaming
- **Signaling**: WebSocket-based room communication
- **PTZ Control**: HTTP/ONVIF commands to cameras
- **Fallback**: Canvas-based digital PTZ simulation

### Features Tracked
| Feature | Code | Description |
|---------|------|-------------|
| Video Streaming | video_stream | Real-time video feed |
| PTZ Control | ptz_control | Pan/Tilt/Zoom commands |
| Audio Communication | audio | Two-way voice chat |
| Screen Sharing | screen_share | Desktop/application sharing |
| AR Overlays | ar_overlay | Augmented reality guidance |
| Session Recording | recording | Session video recording |

### API Endpoints
- `GET /webrtc/ice` - Retrieve ICE server configuration
- `WS /rtc` - WebRTC signaling WebSocket
- `GET /camera?room=XXX` - Public camera page
- `GET /remote-camera` - Authenticated viewer page

### Network Configuration
- **Local Testing**: Use machine IP address (e.g., `192.168.1.34:3000`)
- **Cross-Network**: Requires TURN server for NAT traversal
- **Default TURN**: `turn:openrelay.metered.ca:80`
- **Default STUN**: `stun:stun.l.google.com:19302`

## Next Steps

### Phase 1 (Completed)
- [x] Basic video streaming
- [x] PTZ control interface
- [x] WebRTC signaling
- [x] TURN/STUN integration
- [x] Local network testing

### Phase 2 (In Progress)
- [ ] AR overlay integration
- [ ] Screen sharing functionality
- [ ] Session recording
- [ ] Expert scheduling system
- [ ] Mobile app support

### Phase 3 (Planned)
- [ ] AI-powered part identification
- [ ] Automated procedure guidance
- [ ] Integration with maintenance systems
- [ ] Performance analytics
- [ ] Multi-expert sessions

## Client Requirements

### Hardware
- Camera-equipped devices (laptops, tablets, smartphones)
- PTZ cameras with ONVIF support (for equipment)
- Stable internet connection (minimum 5 Mbps upload)
- Audio input/output devices
- Network access to TURN server

### Software
- Modern web browser (Chrome, Firefox, Safari, Edge)
- WebRTC support
- WebSocket support
- Camera and microphone permissions

### Configuration
- Assign Remote Maintenance module to relevant machines
- Configure TURN server credentials
- Set up camera access permissions
- Define expert availability schedules
- Configure session recording settings

### Network Setup
- **Same Network**: Use local IP address for testing
- **Different Networks**: Configure TURN server
- **VPN Option**: Use VPN tunnel for secure access
- **Public IP**: Port forwarding for direct access

## PTZ Camera Integration

### Supported Cameras
- ONVIF-compliant PTZ cameras
- RTSP streaming support
- HTTP API control
- Network connectivity

### Camera Configuration
- RTSP stream URL
- ONVIF endpoint URL
- Authentication credentials
- Network access method (VPN, public IP, etc.)

### Testing Guide
See `docs/PTZ_CAMERA_TESTING.md` for detailed testing requirements and network setup options.

## Support & Maintenance
- Real-time video quality monitoring
- Session performance metrics
- TURN server health checks
- Regular security updates
- Expert availability management

---

**Last Updated**: July 23, 2026
**Version**: 1.0.0
**Status**: Production Ready (AR Features Pending)
