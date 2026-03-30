package handlers

import (
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/models"

	"github.com/gofiber/fiber/v2"
)

// ListCompanies - Superadmin can list all companies
func ListCompanies(c *fiber.Ctx) error {
	var companies []models.Company

	result := database.DB.Find(&companies)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch companies",
		})
	}

	return c.JSON(companies)
}

// GetCompany - Get a specific company by ID
func GetCompany(c *fiber.Ctx) error {
	id := c.Params("id")

	var company models.Company
	result := database.DB.First(&company, "id = ?", id)
	if result.Error != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "Company not found",
		})
	}

	return c.JSON(company)
}

// CreateCompany - Superadmin can create new companies
func CreateCompany(c *fiber.Ctx) error {
	var req models.CreateCompanyRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Name == "" || req.Slug == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "Name and slug are required",
		})
	}

	// Check if slug already exists
	var existingCompany models.Company
	result := database.DB.Where("slug = ?", req.Slug).First(&existingCompany)
	if result.Error == nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Company with this slug already exists",
		})
	}

	// Create company
	company := models.Company{
		Name:      req.Name,
		Slug:      req.Slug,
		Status:    req.Status,
		Metadata:  req.Metadata,
		UpdatedAt: time.Now(),
	}

	result = database.DB.Create(&company)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to create company",
		})
	}

	return c.Status(201).JSON(company)
}

// UpdateCompany - Superadmin can update companies
func UpdateCompany(c *fiber.Ctx) error {
	id := c.Params("id")

	var req models.UpdateCompanyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	var company models.Company
	result := database.DB.First(&company, "id = ?", id)
	if result.Error != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "Company not found",
		})
	}

	// Update fields if provided
	if req.Name != nil && *req.Name != "" {
		company.Name = *req.Name
	}
	if req.Slug != nil && *req.Slug != "" {
		// Check if slug already exists (excluding current company)
		var existingCompany models.Company
		checkResult := database.DB.Where("slug = ? AND id != ?", *req.Slug, id).First(&existingCompany)
		if checkResult.Error == nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "Company with this slug already exists",
			})
		}
		company.Slug = *req.Slug
	}
	if req.Status != nil && *req.Status != "" {
		company.Status = *req.Status
	}
	if req.Metadata != nil {
		company.Metadata = *req.Metadata
	}

	result = database.DB.Save(&company)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to update company",
		})
	}

	return c.JSON(company)
}

// DeleteCompany - Superadmin can delete companies
func DeleteCompany(c *fiber.Ctx) error {
	id := c.Params("id")

	var company models.Company
	result := database.DB.First(&company, "id = ?", id)
	if result.Error != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "Company not found",
		})
	}

	// Delete company (cascade will handle related records)
	result = database.DB.Delete(&company)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to delete company",
		})
	}

	return c.Status(200).JSON(fiber.Map{
		"message": "Company deleted successfully",
	})
}

// GetCompanyStats - Get statistics for a specific company
func GetCompanyStats(c *fiber.Ctx) error {
	id := c.Params("id")

	// Check if company exists
	var company models.Company
	result := database.DB.First(&company, "id = ?", id)
	if result.Error != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "Company not found",
		})
	}

	// Get company statistics
	var stats struct {
		UserCount    int64 `json:"user_count"`
		MachineCount int64 `json:"machine_count"`
		RoleCount    int64 `json:"role_count"`
		StatsCount   int64 `json:"stats_count"`
	}

	database.DB.Model(&models.CompanyUser{}).Where("company_id = ?", id).Count(&stats.UserCount)
	database.DB.Model(&models.Machine{}).Where("company_id = ?", id).Count(&stats.MachineCount)
	database.DB.Model(&models.Role{}).Where("company_id = ?", id).Count(&stats.RoleCount)

	// Count machine stats for this company's machines
	database.DB.Table("machine_stats").
		Joins("JOIN machines ON machines.id = machine_stats.machine_id").
		Where("machines.company_id = ?", id).
		Count(&stats.StatsCount)

	return c.JSON(stats)
}

// GetCompaniesWithStats - List all companies with their statistics
func GetCompaniesWithStats(c *fiber.Ctx) error {
	type CompanyWithStats struct {
		models.Company
		UserCount    int64 `json:"user_count"`
		MachineCount int64 `json:"machine_count"`
		RoleCount    int64 `json:"role_count"`
		StatsCount   int64 `json:"stats_count"`
	}

	var companies []models.Company
	result := database.DB.Find(&companies)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch companies",
		})
	}

	var companiesWithStats []CompanyWithStats
	for _, company := range companies {
		var stats CompanyWithStats
		stats.Company = company

		database.DB.Model(&models.CompanyUser{}).Where("company_id = ?", company.ID).Count(&stats.UserCount)
		database.DB.Model(&models.Machine{}).Where("company_id = ?", company.ID).Count(&stats.MachineCount)
		database.DB.Model(&models.Role{}).Where("company_id = ?", company.ID).Count(&stats.RoleCount)

		database.DB.Table("machine_stats").
			Joins("JOIN machines ON machines.id = machine_stats.machine_id").
			Where("machines.company_id = ?", company.ID).
			Count(&stats.StatsCount)

		companiesWithStats = append(companiesWithStats, stats)
	}

	return c.JSON(companiesWithStats)
}
