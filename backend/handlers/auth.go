package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// POST /api/v1/auth/change-password
func ChangePassword(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Validate input
	if len(req.CurrentPassword) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "Current password must be at least 6 characters"})
	}
	if len(req.NewPassword) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "New password must be at least 6 characters"})
	}
	if req.CurrentPassword == req.NewPassword {
		return c.Status(400).JSON(fiber.Map{"error": "Current password and new password must be different"})
	}

	// For superadmin, we don't have a local password (they use Supabase)
	if auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "Superadmin password changes must be done through Supabase"})
	}

	// Get the user's Supabase ID from auth context
	supabaseID := auth.AuthUserID.String()
	userEmail := auth.CompanyUser.Email

	// First, verify the current password by attempting to sign in with Supabase
	signInBody := map[string]string{
		"email":    userEmail,
		"password": req.CurrentPassword,
	}
	signInJSON, _ := json.Marshal(signInBody)

	signInReq, err := http.NewRequest("POST", "https://byhnyrhltrqjzqhsajli.supabase.co/auth/v1/token?grant_type=password", bytes.NewBuffer(signInJSON))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create sign-in request"})
	}
	signInReq.Header.Set("Content-Type", "application/json")
	signInReq.Header.Set("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aG55cmhsdHJxanpxaHNhamxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDM2MjksImV4cCI6MjA4ODAxOTYyOX0.qex_-KP-vAF6TZ6e92xMuNdqm0SHfkoxGI3DVY5fUyI")

	client := &http.Client{}
	signInResp, err := client.Do(signInReq)
	if err != nil || signInResp.StatusCode != 200 {
		return c.Status(400).JSON(fiber.Map{"error": "Current password is incorrect"})
	}
	defer signInResp.Body.Close()

	// Now update the password in Supabase using the Admin API
	updateBody := map[string]string{
		"password": req.NewPassword,
	}
	updateJSON, _ := json.Marshal(updateBody)

	updateReq, err := http.NewRequest("PUT", fmt.Sprintf("https://byhnyrhltrqjzqhsajli.supabase.co/auth/v1/admin/users/%s", supabaseID), bytes.NewBuffer(updateJSON))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create update request"})
	}
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aG55cmhsdHJxanpxaHNhamxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ0MzYyOSwiZXhwIjoyMDg4MDE5NjI5fQ.LRqnCUfuniO3DgiRvE2EUC_r3KLGWW5jB-5J8KZG9AI")
	updateReq.Header.Set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aG55cmhsdHJxanpxaHNhamxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ0MzYyOSwiZXhwIjoyMDg4MDE5NjI5fQ.LRqnCUfuniO3DgiRvE2EUC_r3KLGWW5jB-5J8KZG9AI")

	updateResp, err := client.Do(updateReq)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update password in Supabase: " + err.Error()})
	}
	defer updateResp.Body.Close()

	// Check if the update was successful
	if updateResp.StatusCode != 200 {
		body, _ := io.ReadAll(updateResp.Body)
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Failed to update password in Supabase: %s", string(body))})
	}

	// Hash the new password for local storage
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	// Update user's password in database
	result := database.DB.Model(&models.CompanyUser{}).
		Where("auth_user_id = ?", supabaseID).
		Update("hashed_password", string(hashedPassword))

	if result.Error != nil {
		// Log the error but don't fail since Supabase update succeeded
		fmt.Printf("Warning: Failed to update local password: %v\n", result.Error)
	}

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{"message": "Password changed successfully"})
}
