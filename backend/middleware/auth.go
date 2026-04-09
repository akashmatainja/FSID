package middleware

import (
	"strings"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// JWTAuth validates the Supabase JWT and loads the AuthContext into locals.
func JWTAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")

		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing authorization header"})
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			// Check for ES256 signing method (Supabase default)
			if _, ok := t.Method.(*jwt.SigningMethodECDSA); ok {
				// For ES256, we need the public key
				publicKey := strings.ReplaceAll(jwtSecret, "\\n", "\n") // Replace \n with actual newlines
				key, err := jwt.ParseECPublicKeyFromPEM([]byte(publicKey))
				if err != nil {
					return nil, fiber.NewError(fiber.StatusUnauthorized, "invalid public key format")
				}
				return key, nil
			}
			// Fallback to HMAC for older tokens
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); ok {
				return []byte(jwtSecret), nil
			}
			return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid claims"})
		}

		sub, ok := claims["sub"].(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing sub claim"})
		}

		authUserID, err := uuid.Parse(sub)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid sub uuid"})
		}

		// Check if this is the superadmin user
		const SUPERADMIN_AUTH_ID = "e7033950-b3cf-404b-bc56-4d21f02bec07"
		isSuperadmin := authUserID.String() == SUPERADMIN_AUTH_ID

		// Create auth context
		ctx := &models.AuthContext{
			AuthUserID:  authUserID,
			CompanyID:   uuid.Nil, // Superadmin has no company
			Permissions: make(map[string]bool),
		}

		if isSuperadmin {
			// Superadmin gets all permissions
			ctx.Permissions = map[string]bool{
				"dashboard.read":      true,
				"machines.read":       true,
				"machines.write":      true,
				"roles.read":          true,
				"roles.write":         true,
				"users.read":          true,
				"users.write":         true,
				"stats.read_all":      true,
				"stats.read_assigned": true,
				"stats.write":         true,
				"companies.read":      true,
				"companies.write":     true,
				"branches.read":       true,
				"branches.write":      true,
				"subdivisions.read":   true,
				"subdivisions.write":  true,
				"superadmin":          true,
			}
		} else {
			// For regular users, load permissions from database via roles
			permissions := make(map[string]bool)

			var user models.CompanyUser
			if err := database.DB.Preload("UserRoles.Role.RolePermissions.Permission").First(&user, "auth_user_id = ?", authUserID).Error; err == nil {
				// Set company ID from user
				ctx.CompanyID = user.CompanyID
				// Store the full user object in context
				ctx.CompanyUser = user

				// Collect permissions from all user roles
				for _, userRole := range user.UserRoles {
					if userRole.Role.ID != uuid.Nil {
						for _, rolePermission := range userRole.Role.RolePermissions {
							if rolePermission.Permission.ID != uuid.Nil {
								permissions[rolePermission.Permission.Key] = true
							}
						}
					}
				}
			} else {
				// User not found, return empty permissions
			}

			ctx.Permissions = permissions
		}

		c.Locals("auth", ctx)
		return c.Next()
	}
}

// RequirePermission returns a middleware that checks for a specific permission key.
func RequirePermission(key string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := GetAuth(c)
		if !auth.Permissions[key] {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "insufficient permissions"})
		}
		return c.Next()
	}
}

// GetAuth returns the AuthContext from the request locals.
func GetAuth(c *fiber.Ctx) *models.AuthContext {
	return c.Locals("auth").(*models.AuthContext)
}
