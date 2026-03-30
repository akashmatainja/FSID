package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/companyuser/backend/config"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/users/me - Dynamic implementation
func GetMe(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// For superadmin, return basic auth context without company_users lookup
	if auth.Permissions["superadmin"] {
		return c.JSON(fiber.Map{
			"id":            auth.AuthUserID,
			"auth_user_id":  auth.AuthUserID,
			"name":          "Platform Superadmin",
			"email":         "superadmin@platform.com",
			"status":        "active",
			"company":       nil,
			"user_roles":    []interface{}{},  // Empty array for frontend compatibility
			"user_machines": []interface{}{},  // Empty array for frontend compatibility
			"permissions":   auth.Permissions, // Include permissions directly for superadmin
		})
	}

	// Find current user in database with relationships
	var user models.CompanyUser
	if err := database.DB.Preload("UserRoles.Role.RolePermissions.Permission").First(&user, "auth_user_id = ?", auth.AuthUserID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Update auth context with user's company
	auth.CompanyUser = user
	auth.CompanyID = user.CompanyID

	return c.JSON(user)
}

// GET /api/v1/users - Dynamic implementation
func ListUsers(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Query database for users with simple approach
	var users []models.CompanyUser
	query := database.DB

	// If not superadmin, only show users from same company
	if !auth.Permissions["superadmin"] {
		query = query.Where("company_id = ?", auth.CompanyID)
	}

	if err := query.Preload("MachineAssignments.Machine").Find(&users).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch users", "details": err.Error()})
	}

	// Manually load relationships for each user
	for i := range users {
		// Load company
		database.DB.First(&users[i].Company, "id = ?", users[i].CompanyID)
		// Load user roles
		database.DB.Preload("Role").Find(&users[i].UserRoles, "user_id = ?", users[i].ID)
	}

	return c.JSON(users)
}

// GET /api/v1/users/:id - Dynamic implementation
func GetUser(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	userID := c.Params("id")

	// Find user in database
	var user models.CompanyUser
	if err := database.DB.Preload("Company").Preload("UserRoles.Role").First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Check permissions - can only view users in same company unless superadmin
	if !auth.Permissions["superadmin"] && user.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	return c.JSON(user)
}

// POST /api/v1/users - Create user in both auth.users and company_users tables
func CreateUser(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var req struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		RoleID    string `json:"role_id"`
		Password  string `json:"password"`   // For initial user creation
		CompanyID string `json:"company_id"` // For superadmin to specify company
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Create user in Supabase auth.users table
	authUserID, err := createSupabaseUser(req.Email, req.Password, req.Name)
	if err != nil {
		fmt.Printf("DEBUG: Failed to create Supabase user: %v\n", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create auth user", "details": err.Error()})
	}
	fmt.Printf("DEBUG: Created Supabase user with ID: %s\n", authUserID.String())

	// Determine which company to use
	var targetCompanyID uuid.UUID
	if auth.Permissions["superadmin"] && req.CompanyID != "" {
		// Superadmin can specify company - validate it exists
		var company models.Company
		if err := database.DB.First(&company, "id = ?", req.CompanyID).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid company ID"})
		}
		targetCompanyID = models.MustParseUUID(req.CompanyID)
	} else if auth.Permissions["superadmin"] && req.CompanyID == "" {
		// Superadmin must specify company when creating users
		return c.Status(400).JSON(fiber.Map{"error": "Superadmin must specify a company when creating users"})
	} else if auth.CompanyID == uuid.Nil {
		// Non-superadmin without company (shouldn't happen)
		return c.Status(403).JSON(fiber.Map{"error": "Cannot create users without company assignment"})
	} else {
		// Regular users can only create users in their own company
		targetCompanyID = auth.CompanyID
	}

	// Create user in company_users table
	user := models.CompanyUser{
		CompanyID:  targetCompanyID,
		AuthUserID: authUserID,
		Name:       req.Name,
		Email:      req.Email,
		Status:     "active",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		// Rollback: delete auth user if company user creation fails
		deleteSupabaseUser(authUserID)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}

	// Assign role if provided
	if req.RoleID != "" {
		userRole := models.UserRole{
			UserID: user.ID,
			RoleID: models.MustParseUUID(req.RoleID),
		}
		if err := database.DB.Create(&userRole).Error; err != nil {
			// Rollback: delete both users if role assignment fails
			database.DB.Delete(&user)
			deleteSupabaseUser(authUserID)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to assign role"})
		}
	}

	// Load relationships
	database.DB.Preload("Company").Preload("UserRoles.Role").First(&user, "id = ?", user.ID)

	return c.Status(201).JSON(user)
}

// createSupabaseUser creates a user in Supabase auth.users table via Admin API
func createSupabaseUser(email, password, name string) (uuid.UUID, error) {
	userID := uuid.New()

	// Basic email validation
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return uuid.Nil, fmt.Errorf("invalid email format: %s", email)
	}

	payload := map[string]interface{}{
		"id":       userID.String(),
		"email":    email,
		"password": password,
		"user_metadata": map[string]interface{}{
			"name": name,
		},
		"email_confirm": true,
	}

	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest(
		"POST",
		config.Cfg.SupabaseURL+"/auth/v1/admin/users",
		bytes.NewBuffer(payloadBytes),
	)
	if err != nil {
		return uuid.Nil, err
	}

	req.Header.Set("Authorization", "Bearer "+config.Cfg.SupabaseServiceRoleKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", config.Cfg.SupabaseServiceRoleKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return uuid.Nil, err
	}
	defer resp.Body.Close()

	// Read response body for debugging
	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("DEBUG: Supabase API Response Status: %d\n", resp.StatusCode)
	fmt.Printf("DEBUG: Supabase API Response Body: %s\n", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return uuid.Nil, fmt.Errorf("Supabase API returned status %d: %s", resp.StatusCode, string(body))
	}

	return userID, nil
}

// deleteSupabaseUser deletes a user from Supabase auth.users table via Admin API
func deleteSupabaseUser(userID uuid.UUID) error {
	req, err := http.NewRequest(
		"DELETE",
		config.Cfg.SupabaseURL+"/admin/v1/users/"+userID.String(),
		nil,
	)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+config.Cfg.SupabaseServiceRoleKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// PUT /api/v1/users/:id - Dynamic implementation
func UpdateUser(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	userID := c.Params("id")

	var req struct {
		Name   string `json:"name"`
		Email  string `json:"email"`
		RoleID string `json:"role_id"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Find user in database
	var user models.CompanyUser
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Check permissions - can only edit users in same company unless superadmin
	if !auth.Permissions["superadmin"] && user.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	// Update user
	user.Name = req.Name
	user.Email = req.Email
	if err := database.DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user"})
	}

	// Update role assignment
	if req.RoleID != "" {
		// Delete existing role assignments
		database.DB.Where("user_id = ?", user.ID).Delete(&models.UserRole{})

		// Create new role assignment
		userRole := models.UserRole{
			UserID: user.ID,
			RoleID: models.MustParseUUID(req.RoleID),
		}
		if err := database.DB.Create(&userRole).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to assign role"})
		}
	}

	// Reload with relationships
	if err := database.DB.Preload("Company").Preload("UserRoles.Role").First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reload user"})
	}

	return c.JSON(user)
}

// DELETE /api/v1/users/:id - Dynamic implementation
func DeleteUser(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	userID := c.Params("id")

	// Simple self-deletion protection as backup
	if auth.AuthUserID.String() == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot delete your own account"})
	}

	// Find user in database
	var user models.CompanyUser
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Check permissions - can only delete users in same company unless superadmin
	if !auth.Permissions["superadmin"] && user.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	// Delete user
	if err := database.DB.Delete(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user"})
	}

	return c.JSON(fiber.Map{"message": "User deleted successfully"})
}
