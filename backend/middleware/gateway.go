package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
)

// HashGatewayKey returns the stored form of a gateway API key.
func HashGatewayKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// GatewayAuth authenticates an OPC UA edge gateway by its API key, sent as
// "Authorization: Bearer <key>" or "X-Gateway-Key: <key>". The gateway is
// stored in c.Locals("gateway"); read it with GetGateway.
func GatewayAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := strings.TrimSpace(c.Get("X-Gateway-Key"))
		if key == "" {
			if h := c.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
				key = strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
			}
		}
		if key == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing gateway key"})
		}

		var gw models.OPCUAGateway
		if err := database.DB.Where("key_hash = ?", HashGatewayKey(key)).First(&gw).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid gateway key"})
		}
		if !gw.IsActive {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "gateway is disabled"})
		}

		// Heartbeat, throttled so a busy gateway doesn't write on every request.
		if gw.LastSeenAt == nil || time.Since(*gw.LastSeenAt) > 15*time.Second {
			database.DB.Model(&models.OPCUAGateway{}).Where("id = ?", gw.ID).
				UpdateColumns(map[string]any{"last_seen_at": time.Now(), "last_ip": clientIP(c)})
		}

		c.Locals("gateway", &gw)
		return c.Next()
	}
}

// GetGateway returns the authenticated gateway (only on GatewayAuth routes).
func GetGateway(c *fiber.Ctx) *models.OPCUAGateway {
	gw, _ := c.Locals("gateway").(*models.OPCUAGateway)
	return gw
}

// clientIP prefers the first X-Forwarded-For hop (Railway/Vercel sit behind a proxy).
func clientIP(c *fiber.Ctx) string {
	if xff := c.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	return c.IP()
}
