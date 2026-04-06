package handlers

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
)

// ListBranches returns all branches for the authenticated user's company
func ListBranches(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var branches []models.Branch
	var err error

	if auth.Permissions["superadmin"] {
		// Superadmin can see all branches
		err = database.DB.Preload("Company").Find(&branches).Error
	} else {
		// Company users can only see branches from their company
		err = database.DB.Preload("Company").Where("company_id = ?", auth.CompanyID).Find(&branches).Error
	}

	if err != nil {
		log.Printf("Error fetching branches: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch branches"})
	}

	return c.JSON(branches)
}

// GetBranch returns a specific branch
func GetBranch(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	branchID := c.Params("id")

	// Validate UUID
	if _, err := uuid.Parse(branchID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid branch ID"})
	}

	var branch models.Branch
	err := database.DB.Preload("Company").Preload("Machines").First(&branch, "id = ?", branchID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Branch not found"})
		}
		log.Printf("Error fetching branch: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch branch"})
	}

	// Check permissions
	if !auth.Permissions["superadmin"] && branch.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	return c.JSON(branch)
}

// CreateBranch creates a new branch
func CreateBranch(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Check permissions - only company admin or superadmin can create branches
	if !auth.Permissions["superadmin"] && !auth.Permissions["branches.write"] {
		return c.Status(403).JSON(fiber.Map{"error": "Insufficient permissions"})
	}

	var req models.CreateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Set default status if not provided
	if req.Status == "" {
		req.Status = "active"
	}

	// Create branch
	branch := models.Branch{
		CompanyID: auth.CompanyID, // Always use authenticated user's company
		Name:      req.Name,
		Code:      req.Code,
		Address:   req.Address,
		City:      req.City,
		State:     req.State,
		Pincode:   req.Pincode,
		Phone:     req.Phone,
		Email:     req.Email,
		Status:    req.Status,
	}

	// Superadmin can specify company_id in the request (for admin purposes)
	if auth.Permissions["superadmin"] && c.Query("company_id") != "" {
		if companyID, err := uuid.Parse(c.Query("company_id")); err == nil {
			branch.CompanyID = companyID
		}
	}

	if err := database.DB.Create(&branch).Error; err != nil {
		log.Printf("Error creating branch: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create branch"})
	}

	// Load company details for response
	if err := database.DB.Preload("Company").First(&branch, "id = ?", branch.ID).Error; err != nil {
		log.Printf("Error loading branch details: %v", err)
	}

	return c.Status(201).JSON(branch)
}

// UpdateBranch updates an existing branch
func UpdateBranch(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	branchID := c.Params("id")

	// Validate UUID
	if _, err := uuid.Parse(branchID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid branch ID"})
	}

	// Check permissions
	if !auth.Permissions["superadmin"] && !auth.Permissions["branches.write"] {
		return c.Status(403).JSON(fiber.Map{"error": "Insufficient permissions"})
	}

	var branch models.Branch
	if err := database.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Branch not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch branch"})
	}

	// Check if user can access this branch
	if !auth.Permissions["superadmin"] && branch.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	var req models.UpdateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields if provided
	if req.Name != nil {
		branch.Name = *req.Name
	}
	if req.Code != nil {
		branch.Code = *req.Code
	}
	if req.Address != nil {
		branch.Address = *req.Address
	}
	if req.City != nil {
		branch.City = *req.City
	}
	if req.State != nil {
		branch.State = *req.State
	}
	if req.Pincode != nil {
		branch.Pincode = *req.Pincode
	}
	if req.Phone != nil {
		branch.Phone = *req.Phone
	}
	if req.Email != nil {
		branch.Email = *req.Email
	}
	if req.Status != nil {
		branch.Status = *req.Status
	}

	if err := database.DB.Save(&branch).Error; err != nil {
		log.Printf("Error updating branch: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update branch"})
	}

	// Load updated details
	if err := database.DB.Preload("Company").First(&branch, "id = ?", branch.ID).Error; err != nil {
		log.Printf("Error loading updated branch: %v", err)
	}

	return c.JSON(branch)
}

// DeleteBranch deletes a branch
func DeleteBranch(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	branchID := c.Params("id")

	// Validate UUID
	if _, err := uuid.Parse(branchID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid branch ID"})
	}

	// Check permissions
	if !auth.Permissions["superadmin"] && !auth.Permissions["branches.write"] {
		return c.Status(403).JSON(fiber.Map{"error": "Insufficient permissions"})
	}

	var branch models.Branch
	if err := database.DB.First(&branch, "id = ?", branchID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Branch not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch branch"})
	}

	// Check if user can access this branch
	if !auth.Permissions["superadmin"] && branch.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	// Check if branch has machines
	var machineCount int64
	if err := database.DB.Model(&models.Machine{}).Where("branch_id = ?", branchID).Count(&machineCount).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check branch dependencies"})
	}

	if machineCount > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "Cannot delete branch with existing equipment",
			"count": machineCount,
		})
	}

	if err := database.DB.Delete(&branch).Error; err != nil {
		log.Printf("Error deleting branch: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete branch"})
	}

	return c.JSON(fiber.Map{"message": "Branch deleted successfully"})
}
