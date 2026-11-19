package handlers

// WebRTC support for the Remote Camera feature.
//
// GET /webrtc/ice  (public)
//   Returns the ICE server list (STUN + TURN) the browser needs to establish
//   a peer connection. TURN credentials come from config/env so they can be
//   rotated without code changes. This endpoint is intentionally public so the
//   unauthenticated camera page (remote site) can fetch it too.

import (
	"github.com/companyuser/backend/config"
	"github.com/gofiber/fiber/v2"
)

type iceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

func GetICEServers(c *fiber.Ctx) error {
	servers := []iceServer{}

	if config.Cfg.StunURL != "" {
		servers = append(servers, iceServer{URLs: []string{config.Cfg.StunURL}})
	}

	if config.Cfg.TurnURL != "" {
		// Offer the TURN server over both UDP/TCP (:80) and, if available, TLS.
		urls := []string{
			config.Cfg.TurnURL,
			config.Cfg.TurnURL + "?transport=tcp",
		}
		servers = append(servers, iceServer{
			URLs:       urls,
			Username:   config.Cfg.TurnUsername,
			Credential: config.Cfg.TurnCredential,
		})
	}

	return c.JSON(fiber.Map{"iceServers": servers})
}
