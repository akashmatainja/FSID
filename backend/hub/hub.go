package hub

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
)

// MetricPayload is broadcast over WebSocket to the dashboard
// and buffered for periodic DB writes.
type MetricPayload struct {
	MachineID   string    `json:"machine_id"`
	CompanyID   string    `json:"company_id"`
	MetricKey   string    `json:"metric_key"`
	MetricValue float64   `json:"metric_value"`
	Timestamp   time.Time `json:"timestamp"`
	Unit        string    `json:"unit"`
	Source      string    `json:"source"` // "opcua_sim" | "opcua_real"
}

// wsClient represents one active browser WebSocket connection.
type wsClient struct {
	machineID string
	conn      *websocket.Conn
	send      chan []byte
}

// broadcastMsg carries a serialised payload destined for one machine's watchers.
type broadcastMsg struct {
	machineID string
	payload   []byte
}

// Hub manages all WebSocket connections, keyed by machine ID.
type Hub struct {
	mu         sync.RWMutex
	clients    map[string]map[*wsClient]struct{} // machineID → set
	register   chan *wsClient
	unregister chan *wsClient
	publish    chan *broadcastMsg
}

var GlobalHub *Hub

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*wsClient]struct{}),
		register:   make(chan *wsClient, 32),
		unregister: make(chan *wsClient, 32),
		publish:    make(chan *broadcastMsg, 512),
	}
}

// Run is the Hub's event loop — must be called in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[c.machineID]; !ok {
				h.clients[c.machineID] = make(map[*wsClient]struct{})
			}
			h.clients[c.machineID][c] = struct{}{}
			h.mu.Unlock()
			log.Printf("[WS] +client machine=%s total=%d", c.machineID, len(h.clients[c.machineID]))

		case c := <-h.unregister:
			h.mu.Lock()
			if set, ok := h.clients[c.machineID]; ok {
				if _, exists := set[c]; exists {
					delete(set, c)
					close(c.send)
				}
				if len(set) == 0 {
					delete(h.clients, c.machineID)
				}
			}
			h.mu.Unlock()
			log.Printf("[WS] -client machine=%s", c.machineID)

		case msg := <-h.publish:
			h.mu.RLock()
			for c := range h.clients[msg.machineID] {
				select {
				case c.send <- msg.payload:
				default:
					// Slow client — drop the frame rather than blocking
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast serialises metrics and routes them to:
//   - clients watching the specific machineID
//   - clients subscribed with the wildcard machineID "*" (all machines)
func (h *Hub) Broadcast(machineID string, metrics []MetricPayload) {
	b, err := json.Marshal(metrics)
	if err != nil {
		return
	}
	msg := &broadcastMsg{payload: b}

	// Send to machine-specific subscribers
	msg.machineID = machineID
	select {
	case h.publish <- msg:
	default:
		log.Println("[WS] publish channel full, dropping frame")
	}

	// Also send to "all" subscribers (global feed)
	b2, _ := json.Marshal(metrics)
	select {
	case h.publish <- &broadcastMsg{machineID: "all", payload: b2}:
	default:
	}
}

// ServeWS is the Fiber WebSocket handler — one goroutine per connection.
func ServeWS(c *websocket.Conn) {
	machineID := c.Query("machine_id")
	log.Printf("[WS] connection attempt, machine_id=%q, remote=%s", machineID, c.RemoteAddr())
	if machineID == "" {
		log.Println("[WS] rejected: missing machine_id")
		c.Close()
		return
	}

	client := &wsClient{
		machineID: machineID,
		conn:      c,
		send:      make(chan []byte, 64),
	}

	GlobalHub.register <- client

	// Read goroutine — drains the browser's side (close frames, pong replies).
	go func() {
		defer func() { GlobalHub.unregister <- client }()
		c.SetReadLimit(10240) // Increased to 10KB for larger messages
		for {
			if _, _, err := c.ReadMessage(); err != nil {
				break
			}
		}
	}()

	// Write loop — sends buffered frames and keepalive pings.
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
