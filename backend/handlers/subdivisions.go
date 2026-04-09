package handlers

import (
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GET /api/v1/subdivisions
func ListSubdivisions(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var subdivisions []models.Subdivision
	query := database.DB.Preload("Company").Preload("Branch")

	// Filter by branch_id if provided
	branchID := c.Query("branch_id")
	if branchID != "" {
		query = query.Where("branch_id = ?", branchID)
	}

	// Superadmin sees all subdivisions, regular users see only their company's
	if auth.Permissions["superadmin"] {
		query.Find(&subdivisions)
	} else {
		query.Where("company_id = ?", auth.CompanyID).Find(&subdivisions)
	}

	return c.JSON(subdivisions)
}

// GET /api/v1/subdivisions/:id
func GetSubdivision(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id := c.Params("id")

	var subdivision models.Subdivision
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		query = database.DB.Where("id = ?", id)
	} else {
		query = database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID)
	}

	if err := query.Preload("Company").Preload("Branch").First(&subdivision).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "subdivision not found"})
	}

	return c.JSON(subdivision)
}

// POST /api/v1/subdivisions
func CreateSubdivision(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var req models.CreateSubdivisionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	branchID, err := uuid.Parse(req.BranchID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid branch_id"})
	}

	// Verify branch exists and belongs to the company
	var branch models.Branch
	if err := database.DB.Where("id = ? AND company_id = ?", branchID, auth.CompanyID).First(&branch).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "branch not found or access denied"})
	}

	subdivision := models.Subdivision{
		ID:          uuid.New(),
		CompanyID:   auth.CompanyID,
		BranchID:    branchID,
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		Status:      req.Status,
	}

	if subdivision.Status == "" {
		subdivision.Status = "active"
	}

	if err := database.DB.Create(&subdivision).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create subdivision"})
	}

	// Reload with relationships
	database.DB.Preload("Company").Preload("Branch").First(&subdivision, "id = ?", subdivision.ID)

	return c.Status(201).JSON(subdivision)
}

// PUT /api/v1/subdivisions/:id
func UpdateSubdivision(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id := c.Params("id")

	var subdivision models.Subdivision
	if err := database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID).First(&subdivision).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "subdivision not found"})
	}

	var req models.UpdateSubdivisionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Code != nil {
		updates["code"] = *req.Code
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&subdivision).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to update subdivision"})
		}
	}

	// Reload with relationships
	database.DB.Preload("Company").Preload("Branch").First(&subdivision, "id = ?", subdivision.ID)

	return c.JSON(subdivision)
}

// DELETE /api/v1/subdivisions/:id
func DeleteSubdivision(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id := c.Params("id")

	var subdivision models.Subdivision
	if err := database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID).First(&subdivision).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "subdivision not found"})
	}

	if err := database.DB.Delete(&subdivision).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete subdivision"})
	}

	return c.JSON(fiber.Map{"message": "subdivision deleted successfully"})
}
