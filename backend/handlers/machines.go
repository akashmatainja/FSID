package handlers

import (
	"strings"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// parseDate parses a date string in YYYY-MM-DD format
func parseDate(dateStr string) time.Time {
	if dateStr == "" {
		return time.Time{}
	}
	if date, err := time.Parse("2006-01-02", dateStr); err == nil {
		return date
	}
	return time.Time{}
}

// GET /api/v1/machines
func ListMachines(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var machines []models.Machine
	var err error

	if auth.Permissions["superadmin"] {
		// Superadmin can see all machines with company info
		err = database.DB.
			Preload("Company").
			Preload("Modules").
			Order("created_at DESC").
			Find(&machines).Error

		// If preload doesn't work, manually load company data
		if err == nil {
			for i := range machines {
				var company models.Company
				if database.DB.First(&company, "id = ?", machines[i].CompanyID).Error == nil {
					machines[i].Company = company
				}
			}
		}
	} else {
		// Regular users only see machines from their company
		err = database.DB.
			Where("company_id = ?", auth.CompanyID).
			Preload("Modules").
			Order("created_at DESC").
			Find(&machines).Error
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(machines)
}

// GET /api/v1/machines/:id
func GetMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	var machine models.Machine
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		// Superadmin can access any machine
		query = database.DB.Where("id = ?", id)
	} else {
		// Regular users can only access machines in their company
		query = database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID)
	}

	if err := query.First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	// Preload company, branch, and modules data
	if database.DB.Preload("Company").Preload("Branch").Preload("Modules").First(&machine, "id = ?", id).Error == nil {
		// Company, branch, and modules data loaded successfully
	} else {
		// Manual loading fallback
		if machine.Company.ID == uuid.Nil {
			var company models.Company
			if database.DB.First(&company, "id = ?", machine.CompanyID).Error == nil {
				machine.Company = company
			}
		}
		if machine.Branch.ID == uuid.Nil {
			var branch models.Branch
			if database.DB.First(&branch, "id = ?", machine.BranchID).Error == nil {
				machine.Branch = branch
			}
		}
	}

	return c.JSON(machine)
}

// POST /api/v1/machines
func CreateMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var req struct {
		Name                string   `json:"name"`
		Code                string   `json:"code"`
		Location            string   `json:"location"`
		Status              string   `json:"status"`
		CompanyID           string   `json:"company_id"`
		BranchID            string   `json:"branch_id"`
		SubdivisionID       string   `json:"subdivision_id"`
		ModuleIDs           []string `json:"module_ids"`
		EquipmentType       string   `json:"equipment_type"`
		RatedPower          float64  `json:"rated_power"`
		VoltageRating       string   `json:"voltage_rating"`
		EnergyMeterID       string   `json:"energy_meter_id"`
		OperatingHours      float64  `json:"operating_hours"`
		Manufacturer        string   `json:"manufacturer"`
		ModelNumber         string   `json:"model_number"`
		InstallationDate    string   `json:"installation_date"`
		MaintenanceSchedule string   `json:"maintenance_schedule"`
		Phase               string   `json:"phase"`
		CriticalEquipment   string   `json:"critical_equipment"`
		SubUnitMonitoring   string   `json:"sub_unit_monitoring"`
		BaselineConsumption string   `json:"baseline_consumption"`
		EnergyCostRate      string   `json:"energy_cost_rate"`
		EfficiencyTarget    string   `json:"efficiency_target"`
		SolarCompatible     string   `json:"solar_compatible"`
		SolarPriority       string   `json:"solar_priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Status == "" {
		req.Status = "active"
	}

	// Determine company ID
	companyID := auth.CompanyID
	if auth.Permissions["superadmin"] && req.CompanyID != "" {
		// Validate company exists
		var company models.Company
		if database.DB.First(&company, "id = ?", req.CompanyID).Error != nil {
			return c.Status(400).JSON(fiber.Map{"error": "company not found"})
		}
		parsedCompanyID, _ := uuid.Parse(req.CompanyID)
		companyID = parsedCompanyID
	}

	// Parse and validate branch_id if provided
	var branchID uuid.UUID
	if req.BranchID != "" {
		parsedBranchID, err := uuid.Parse(req.BranchID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid branch id"})
		}
		// Validate branch exists and belongs to the company
		var branch models.Branch
		if database.DB.First(&branch, "id = ? AND company_id = ?", parsedBranchID, companyID).Error != nil {
			return c.Status(400).JSON(fiber.Map{"error": "branch not found or does not belong to the specified company"})
		}
		branchID = parsedBranchID
	}

	// Parse and validate subdivision_id if provided
	var subdivisionID *uuid.UUID
	if req.SubdivisionID != "" {
		if branchID == uuid.Nil {
			return c.Status(400).JSON(fiber.Map{"error": "cannot assign subdivision without branch assignment"})
		}
		parsedSubdivisionID, err := uuid.Parse(req.SubdivisionID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid subdivision id"})
		}
		// Validate subdivision exists and belongs to the branch
		var subdivision models.Subdivision
		if database.DB.First(&subdivision, "id = ? AND branch_id = ? AND company_id = ?", parsedSubdivisionID, branchID, companyID).Error != nil {
			return c.Status(400).JSON(fiber.Map{"error": "subdivision not found or does not belong to the specified branch"})
		}
		subdivisionID = &parsedSubdivisionID
	}

	m := models.Machine{
		ID:                  uuid.New(),
		CompanyID:           companyID,
		BranchID:            branchID,
		SubdivisionID:       subdivisionID,
		Name:                req.Name,
		Code:                req.Code,
		Location:            req.Location,
		Status:              req.Status,
		EquipmentType:       req.EquipmentType,
		RatedPower:          req.RatedPower,
		VoltageRating:       req.VoltageRating,
		EnergyMeterID:       req.EnergyMeterID,
		OperatingHours:      req.OperatingHours,
		Manufacturer:        req.Manufacturer,
		ModelNumber:         req.ModelNumber,
		InstallationDate:    parseDate(req.InstallationDate),
		MaintenanceSchedule: req.MaintenanceSchedule,
		Phase:               req.Phase,
		CriticalEquipment:   req.CriticalEquipment,
		SubUnitMonitoring:   req.SubUnitMonitoring,
		BaselineConsumption: req.BaselineConsumption,
		EfficiencyTarget:    req.EfficiencyTarget,
		SolarCompatible:     req.SolarCompatible,
		SolarPriority:       req.SolarPriority,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}
	if err := database.DB.Create(&m).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Handle module assignments
	if len(req.ModuleIDs) > 0 {
		var machineModules []models.MachineModule
		for _, moduleIDStr := range req.ModuleIDs {
			moduleID, err := uuid.Parse(moduleIDStr)
			if err != nil {
				continue // Skip invalid module IDs
			}

			// Verify module exists
			var module models.Module
			if database.DB.First(&module, "id = ? AND status = ?", moduleID, "active").Error != nil {
				continue // Skip inactive or non-existent modules
			}

			machineModules = append(machineModules, models.MachineModule{
				MachineID: m.ID,
				ModuleID:  moduleID,
				CreatedAt: time.Now(),
			})
		}

		if len(machineModules) > 0 {
			if err := database.DB.Create(&machineModules).Error; err != nil {
				return c.Status(500).JSON(fiber.Map{"error": err.Error()})
			}
		}
	}

	return c.Status(201).JSON(m)
}

// PUT /api/v1/machines/:id
func UpdateMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	var machine models.Machine
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		// Superadmin can update any machine
		query = database.DB.Where("id = ?", id)
	} else {
		// Regular users can only update machines in their company
		query = database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID)
	}

	if err := query.First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	var req struct {
		Name                string   `json:"name"`
		Code                string   `json:"code"`
		Location            string   `json:"location"`
		Status              string   `json:"status"`
		CompanyID           string   `json:"company_id"`
		BranchID            string   `json:"branch_id"`
		SubdivisionID       string   `json:"subdivision_id"`
		ModuleIDs           []string `json:"module_ids"`
		EquipmentType       string   `json:"equipment_type"`
		RatedPower          float64  `json:"rated_power"`
		VoltageRating       string   `json:"voltage_rating"`
		EnergyMeterID       string   `json:"energy_meter_id"`
		OperatingHours      float64  `json:"operating_hours"`
		Manufacturer        string   `json:"manufacturer"`
		ModelNumber         string   `json:"model_number"`
		InstallationDate    string   `json:"installation_date"`
		MaintenanceSchedule string   `json:"maintenance_schedule"`
		Phase               string   `json:"phase"`
		CriticalEquipment   string   `json:"critical_equipment"`
		SubUnitMonitoring   string   `json:"sub_unit_monitoring"`
		BaselineConsumption string   `json:"baseline_consumption"`
		EnergyCostRate      string   `json:"energy_cost_rate"`
		EfficiencyTarget    string   `json:"efficiency_target"`
		SolarCompatible     string   `json:"solar_compatible"`
		SolarPriority       string   `json:"solar_priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Build updates map
	updates := map[string]interface{}{
		"name":                 req.Name,
		"code":                 req.Code,
		"location":             req.Location,
		"status":               req.Status,
		"equipment_type":       req.EquipmentType,
		"rated_power":          req.RatedPower,
		"voltage_rating":       req.VoltageRating,
		"energy_meter_id":      req.EnergyMeterID,
		"operating_hours":      req.OperatingHours,
		"manufacturer":         req.Manufacturer,
		"model_number":         req.ModelNumber,
		"installation_date":    parseDate(req.InstallationDate),
		"maintenance_schedule": req.MaintenanceSchedule,
		"phase":                req.Phase,
		"critical_equipment":   req.CriticalEquipment,
		"sub_unit_monitoring":  req.SubUnitMonitoring,
		"baseline_consumption": req.BaselineConsumption,
		"efficiency_target":    req.EfficiencyTarget,
		"solar_compatible":     req.SolarCompatible,
		"solar_priority":       req.SolarPriority,
		"updated_at":           time.Now(),
	}

	// Handle branch_id update
	if req.BranchID != "" {
		parsedBranchID, err := uuid.Parse(req.BranchID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid branch id"})
		}
		// Validate branch exists and belongs to the machine's company
		var branch models.Branch
		if database.DB.First(&branch, "id = ? AND company_id = ?", parsedBranchID, machine.CompanyID).Error != nil {
			return c.Status(400).JSON(fiber.Map{"error": "branch not found or does not belong to the machine's company"})
		}
		updates["branch_id"] = parsedBranchID
	}

	// Handle subdivision_id update
	if req.SubdivisionID != "" {
		parsedSubdivisionID, err := uuid.Parse(req.SubdivisionID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid subdivision id"})
		}
		// Get the branch_id to validate subdivision
		branchID := machine.BranchID
		if req.BranchID != "" {
			parsedBranchID, _ := uuid.Parse(req.BranchID)
			branchID = parsedBranchID
		}
		if branchID == uuid.Nil {
			return c.Status(400).JSON(fiber.Map{"error": "cannot assign subdivision without branch assignment"})
		}
		// Validate subdivision exists and belongs to the branch
		var subdivision models.Subdivision
		if database.DB.First(&subdivision, "id = ? AND branch_id = ? AND company_id = ?", parsedSubdivisionID, branchID, machine.CompanyID).Error != nil {
			return c.Status(400).JSON(fiber.Map{"error": "subdivision not found or does not belong to the machine's branch"})
		}
		updates["subdivision_id"] = parsedSubdivisionID
	}

	// Only superadmin can change company
	if auth.Permissions["superadmin"] && req.CompanyID != "" {
		// Validate company exists
		var company models.Company
		if database.DB.First(&company, "id = ?", req.CompanyID).Error != nil {
			return c.Status(400).JSON(fiber.Map{"error": "company not found"})
		}
		updates["company_id"] = req.CompanyID
	}

	if err := database.DB.Model(&machine).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Handle module assignments - delete existing and create new ones
	// First delete all existing module assignments for this machine
	if err := database.DB.Where("machine_id = ?", id).Delete(&models.MachineModule{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Then create new module assignments if provided
	if len(req.ModuleIDs) > 0 {
		var machineModules []models.MachineModule
		for _, moduleIDStr := range req.ModuleIDs {
			moduleID, err := uuid.Parse(moduleIDStr)
			if err != nil {
				continue // Skip invalid module IDs
			}

			// Verify module exists
			var module models.Module
			if database.DB.First(&module, "id = ? AND status = ?", moduleID, "active").Error != nil {
				continue // Skip inactive or non-existent modules
			}

			machineModules = append(machineModules, models.MachineModule{
				MachineID: id,
				ModuleID:  moduleID,
				CreatedAt: time.Now(),
			})
		}

		if len(machineModules) > 0 {
			if err := database.DB.Create(&machineModules).Error; err != nil {
				return c.Status(500).JSON(fiber.Map{"error": err.Error()})
			}
		}
	}

	// Reload machine with company data
	if err := database.DB.Preload("Company").Preload("Modules").First(&machine, "id = ?", id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to reload machine"})
	}

	// Manual company loading fallback
	if machine.Company.ID == uuid.Nil {
		var company models.Company
		if database.DB.First(&company, "id = ?", machine.CompanyID).Error == nil {
			machine.Company = company
		}
	}

	return c.JSON(machine)
}

// DELETE /api/v1/machines/:id
func DeleteMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	if err := database.DB.
		Where("id = ? AND company_id = ?", id, auth.CompanyID).
		Delete(&models.Machine{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// GET /api/v1/machines/:id/stats
func GetMachineStats(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	var machine models.Machine
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		// Superadmin can access any machine's stats
		query = database.DB.Where("id = ?", id)
	} else {
		// Regular users need to verify machine belongs to their company
		query = database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID)
	}

	if err := query.First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	// For regular users, check if they have access to this machine's stats
	if !auth.Permissions["superadmin"] && !auth.Permissions["stats.read_all"] {
		var count int64
		database.DB.Model(&models.MachineAssignment{}).
			Where("user_id = ? AND machine_id = ?", auth.CompanyUser.ID, id).
			Count(&count)
		if count == 0 {
			return c.Status(403).JSON(fiber.Map{"error": "not assigned to this machine"})
		}
	}

	// Query params
	metricKey := c.Query("metric_key")
	since := c.Query("since") // ISO timestamp
	limit := 200

	query = database.DB.Model(&models.MachineStat{}).
		Where("machine_id = ?", id).
		Order("ts DESC").
		Limit(limit)

	if metricKey != "" {
		query = query.Where("metric_key = ?", metricKey)
	}
	if since != "" {
		t, err := time.Parse(time.RFC3339, since)
		if err == nil {
			query = query.Where("ts >= ?", t)
		}
	}

	var stats []models.MachineStat
	query.Find(&stats)
	return c.JSON(stats)
}

// POST /api/v1/machines/:id/stats
func IngestMachineStat(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	var machine models.Machine
	if err := database.DB.
		Where("id = ? AND company_id = ?", id, auth.CompanyID).
		First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	var req models.StatIngestionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	ts := time.Now()
	if req.Ts != nil {
		ts = *req.Ts
	}

	stat := models.MachineStat{
		ID:          uuid.New(),
		CompanyID:   auth.CompanyID,
		MachineID:   id,
		Ts:          ts,
		MetricKey:   req.MetricKey,
		MetricValue: req.MetricValue,
		Meta:        req.Meta,
	}
	if err := database.DB.Create(&stat).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(stat)
}

// GET /api/v1/machines/:id/users
func GetMachineUsers(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	// Check if user has access to this machine
	var machine models.Machine
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		// Superadmin can access any machine's users
		query = database.DB.Where("id = ?", id)
	} else {
		// Regular users can only see users for machines in their company
		query = database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID)
	}

	if err := query.First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	var users []models.CompanyUser
	err = database.DB.
		Joins("JOIN machine_assignments ON machine_assignments.user_id = company_users.id").
		Where("machine_assignments.machine_id = ?", id).
		Preload("UserRoles.Role").
		Find(&users).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(users)
}

// POST /api/v1/machines/:id/users
func AssignUserToMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	machineID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	// Check if machine exists and user has access
	var machine models.Machine
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		query = database.DB.Where("id = ?", machineID)
	} else {
		query = database.DB.Where("id = ? AND company_id = ?", machineID, auth.CompanyID)
	}

	if err := query.First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	// Check if user exists and is in the same company
	var user models.CompanyUser
	if auth.Permissions["superadmin"] {
		if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	} else {
		if err := database.DB.First(&user, "id = ? AND company_id = ?", userID, auth.CompanyID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "user not found"})
		}
	}

	// Create assignment
	assignment := models.MachineAssignment{
		MachineID:  machineID,
		UserID:     userID,
		AssignedAt: time.Now(),
	}

	if err := database.DB.Create(&assignment).Error; err != nil {
		// Check if it's a duplicate
		if strings.Contains(err.Error(), "duplicate") {
			return c.Status(400).JSON(fiber.Map{"error": "user already assigned to this machine"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "failed to assign user"})
	}

	return c.Status(201).JSON(fiber.Map{"message": "user assigned successfully"})
}

// DELETE /api/v1/machines/:id/users/:user_id
func UnassignUserFromMachine(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	machineID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}

	userID, err := uuid.Parse(c.Params("user_id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	// Check if machine exists and user has access
	var machine models.Machine
	var query *gorm.DB

	if auth.Permissions["superadmin"] {
		query = database.DB.Where("id = ?", machineID)
	} else {
		query = database.DB.Where("id = ? AND company_id = ?", machineID, auth.CompanyID)
	}

	if err := query.First(&machine).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}

	// Delete assignment
	if err := database.DB.Where("machine_id = ? AND user_id = ?", machineID, userID).Delete(&models.MachineAssignment{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to unassign user"})
	}

	return c.JSON(fiber.Map{"message": "user unassigned successfully"})
}
