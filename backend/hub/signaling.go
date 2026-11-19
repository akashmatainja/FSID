package hub

// WebRTC signaling hub for the Remote Camera feature.
//
// This is a lightweight, room-based relay. It does NOT touch media — media
// flows peer-to-peer over WebRTC (with TURN relay when needed). The server only
// shuttles small JSON control messages (SDP offer/answer, ICE candidates and
// PTZ commands) between the two peers that share a room.
//
// Endpoint:  GET /rtc?room=<id>&role=<camera|viewer>
//
// Message flow:
//   - On join, the new client receives {"type":"peers","roles":[...]} listing
//     the roles already in the room, and existing peers receive
//     {"type":"peer-joined","role":...}.
//   - Any JSON message a client sends is relayed verbatim to the OTHER clients
//     in the same room (offer/answer/ice/ptz).
//   - On disconnect, remaining peers receive {"type":"peer-left","role":...}.

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
)

type sigClient struct {
	room string
	role string
	conn *websocket.Conn
	send chan []byte
}

type sigInbound struct {
	from *sigClient
	data []byte
}

// SignalingHub manages WebRTC signaling rooms.
type SignalingHub struct {
	mu         sync.RWMutex
	rooms      map[string]map[*sigClient]struct{} // room → set of clients
	register   chan *sigClient
	unregister chan *sigClient
	inbound    chan *sigInbound
}

var GlobalSignaling *SignalingHub

func NewSignalingHub() *SignalingHub {
	return &SignalingHub{
		rooms:      make(map[string]map[*sigClient]struct{}),
		register:   make(chan *sigClient, 32),
		unregister: make(chan *sigClient, 32),
		inbound:    make(chan *sigInbound, 256),
	}
}

func (h *SignalingHub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if _, ok := h.rooms[c.room]; !ok {
				h.rooms[c.room] = make(map[*sigClient]struct{})
			}
			// Collect existing peer roles for the newcomer.
			existing := make([]string, 0, len(h.rooms[c.room]))
			for peer := range h.rooms[c.room] {
				existing = append(existing, peer.role)
			}
			h.rooms[c.room][c] = struct{}{}
			peers := h.rooms[c.room]
			h.mu.Unlock()

			// Tell the newcomer who is already here.
			c.trySend(controlMsg("peers", map[string]any{"roles": existing}))
			// Tell everyone else that a peer joined.
			joined := controlMsg("peer-joined", map[string]any{"role": c.role})
			for peer := range peers {
				if peer != c {
					peer.trySend(joined)
				}
			}
			log.Printf("[RTC] +client room=%s role=%s total=%d", c.room, c.role, len(peers))

		case c := <-h.unregister:
			h.mu.Lock()
			if set, ok := h.rooms[c.room]; ok {
				if _, exists := set[c]; exists {
					delete(set, c)
					close(c.send)
				}
				remaining := make([]*sigClient, 0, len(set))
				for peer := range set {
					remaining = append(remaining, peer)
				}
				if len(set) == 0 {
					delete(h.rooms, c.room)
				}
				h.mu.Unlock()
				left := controlMsg("peer-left", map[string]any{"role": c.role})
				for _, peer := range remaining {
					peer.trySend(left)
				}
				log.Printf("[RTC] -client room=%s role=%s", c.room, c.role)
			} else {
				h.mu.Unlock()
			}

		case in := <-h.inbound:
			// Relay verbatim to the other clients in the room.
			h.mu.RLock()
			for peer := range h.rooms[in.from.room] {
				if peer != in.from {
					peer.trySend(in.data)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func controlMsg(t string, fields map[string]any) []byte {
	m := map[string]any{"type": t}
	for k, v := range fields {
		m[k] = v
	}
	b, _ := json.Marshal(m)
	return b
}

func (c *sigClient) trySend(b []byte) {
	select {
	case c.send <- b:
	default:
		// Slow client — drop rather than block the hub loop.
	}
}

// ServeSignaling is the Fiber WebSocket handler for /rtc.
func ServeSignaling(c *websocket.Conn) {
	room := c.Query("room")
	role := c.Query("role")
	if room == "" || (role != "camera" && role != "viewer") {
		log.Printf("[RTC] rejected: room=%q role=%q", room, role)
		c.Close()
		return
	}

	client := &sigClient{
		room: room,
		role: role,
		conn: c,
		send: make(chan []byte, 64),
	}

	GlobalSignaling.register <- client

	// Read loop — feed inbound messages into the hub.
	go func() {
		defer func() { GlobalSignaling.unregister <- client }()
		c.SetReadLimit(1 << 20) // 1MB — SDP/ICE payloads are small but be safe
		for {
			mt, data, err := c.ReadMessage()
			if err != nil {
				break
			}
			if mt != websocket.TextMessage {
				continue
			}
			cp := make([]byte, len(data))
			copy(cp, data)
			GlobalSignaling.inbound <- &sigInbound{from: client, data: cp}
		}
	}()

	// Write loop — drain send buffer and keepalive.
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()

	for {
		select {
		case msg, ok := <-client.send:
			if !ok {
				c.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ping.C:
			if err := c.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
