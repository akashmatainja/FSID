package handlers

import (
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// POST /api/v1/assignments/roles  — assign role to user
func AssignRole(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	var req struct {
		UserID string `json:"user_id"`
		RoleID string `json:"role_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	userID, err1 := uuid.Parse(req.UserID)
	roleID, err2 := uuid.Parse(req.RoleID)
	if err1 != nil || err2 != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid uuid"})
	}

	// Ensure user + role belong to company
	var user models.CompanyUser
	if auth.Permissions["superadmin"] {
		if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	} else {
		if err := database.DB.Where("id = ? AND company_id = ?", userID, auth.CompanyID).First(&user).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	}

	var role models.Role
	if err := database.DB.Where("id = ? AND company_id = ?", roleID, user.CompanyID).First(&role).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "role not found"})
	}

	ur := models.UserRole{UserID: userID, RoleID: roleID}
	database.DB.Where(ur).FirstOrCreate(&ur)
	return c.Status(201).JSON(fiber.Map{"assigned": true})
}

// DELETE /api/v1/assignments/roles  — remove role from user
func UnassignRole(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	var req struct {
		UserID string `json:"user_id"`
		RoleID string `json:"role_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	userID, err1 := uuid.Parse(req.UserID)
	roleID, err2 := uuid.Parse(req.RoleID)
	if err1 != nil || err2 != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid uuid"})
	}

	// Verify scoped to company
	var user models.CompanyUser
	if err := database.DB.Where("id = ? AND company_id = ?", userID, auth.CompanyID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	database.DB.Where("user_id = ? AND role_id = ?", userID, roleID).Delete(&models.UserRole{})
	return c.SendStatus(204)
}

// POST /api/v1/assignments/machines  — assign machine to user
func AssignMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	var req struct {
		UserID    string `json:"user_id"`
		MachineID string `json:"machine_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	userID, err1 := uuid.Parse(req.UserID)
	machineID, err2 := uuid.Parse(req.MachineID)
	if err1 != nil || err2 != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid uuid"})
	}

	var user models.CompanyUser
	if auth.Permissions["superadmin"] {
		if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	} else {
		if err := database.DB.Where("id = ? AND company_id = ?", userID, auth.CompanyID).First(&user).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	}

	var machine models.Machine
	if auth.Permissions["superadmin"] {
		if err := database.DB.First(&machine, "id = ?", machineID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
		}
	} else {
		if err := database.DB.Where("id = ? AND company_id = ?", machineID, auth.CompanyID).First(&machine).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
		}
	}

	um := models.MachineAssignment{UserID: userID, MachineID: machineID, AssignedAt: time.Now()}
	database.DB.Where(um).FirstOrCreate(&um)
	return c.Status(201).JSON(fiber.Map{"assigned": true})
}

// DELETE /api/v1/assignments/machines  — remove machine from user
func UnassignMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	var req struct {
		UserID    string `json:"user_id"`
		MachineID string `json:"machine_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	userID, err1 := uuid.Parse(req.UserID)
	machineID, err2 := uuid.Parse(req.MachineID)
	if err1 != nil || err2 != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid uuid"})
	}

	var user models.CompanyUser
	if auth.Permissions["superadmin"] {
		if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	} else {
		if err := database.DB.Where("id = ? AND company_id = ?", userID, auth.CompanyID).First(&user).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	}

	database.DB.Where("user_id = ? AND machine_id = ?", userID, machineID).Delete(&models.MachineAssignment{})
	return c.SendStatus(204)
}
