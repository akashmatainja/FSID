package handlers

import (
	"math"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// POST /api/v1/dev/simulate?machine_id=&seconds=30&rate=5
// Streams fake live stats into machine_stats so realtime dashboard can be tested.
func Simulate(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	machineIDStr := c.Query("machine_id")
	seconds, _ := strconv.Atoi(c.Query("seconds", "30"))
	rate, _ := strconv.Atoi(c.Query("rate", "5")) // events per second

	if seconds <= 0 || seconds > 300 {
		seconds = 30
	}
	if rate <= 0 || rate > 20 {
		rate = 5
	}

	var machineIDs []uuid.UUID

	if machineIDStr != "" {
		id, err := uuid.Parse(machineIDStr)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid machine_id"})
		}
		// Verify belongs to company
		var m models.Machine
		if err := database.DB.Where("id = ? AND company_id = ?", id, auth.CompanyID).First(&m).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "machine not found"})
		}
		machineIDs = []uuid.UUID{id}
	} else {
		// All company machines (or all machines if superadmin)
		var machines []models.Machine
		if auth.Permissions["superadmin"] {
			// Superadmin sees all machines from all companies
			database.DB.Find(&machines)
		} else {
			// Regular users see only their company's machines
			database.DB.Where("company_id = ?", auth.CompanyID).Find(&machines)
		}
		for _, m := range machines {
			machineIDs = append(machineIDs, m.ID)
		}
	}

	if len(machineIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no machines found"})
	}

	// Create a map to store machine modules for efficient lookup
	machineModules := make(map[uuid.UUID][]models.Module)

	// Load modules for each machine
	for _, machineID := range machineIDs {
		var machine models.Machine
		if err := database.DB.Preload("Modules").First(&machine, "id = ?", machineID).Error; err == nil {
			machineModules[machineID] = machine.Modules
		}
	}

	// Default base values for common metrics
	baseValues := map[string]float64{
		"power":        250.0,  // kW
		"energy":       1250.0, // kWh
		"voltage":      415.0,  // V
		"current":      32.0,   // A
		"power_factor": 0.85,   // unitless
		"frequency":    50.0,   // Hz
		"temperature":  25.0,   // °C
		"vibration":    5.0,    // mm/s
	}
	units := map[string]string{
		"power":        "kW",
		"energy":       "kWh",
		"voltage":      "V",
		"current":      "A",
		"power_factor": "",
		"frequency":    "Hz",
		"temperature":  "°C",
		"vibration":    "mm/s",
	}

	total := seconds * rate
	interval := time.Duration(1000/rate) * time.Millisecond
	inserted := 0

	for i := 0; i < total; i++ {
		machineID := machineIDs[rand.Intn(len(machineIDs))]

		// Get modules assigned to this machine
		modules := machineModules[machineID]
		if len(modules) == 0 {
			continue // Skip machines with no modules
		}

		// Select a random module from this machine's assigned modules
		module := modules[rand.Intn(len(modules))]
		metric := strings.ToLower(module.Code)

		// Get base value for this metric, use default if not found
		base, ok := baseValues[metric]
		if !ok {
			base = 100.0 // Default fallback value
		}

		// Simulate slight drift + noise
		value := base + math.Sin(float64(i)*0.1)*base*0.05 + (rand.Float64()-0.5)*base*0.03
		value = math.Round(value*1000) / 1000

		stat := models.MachineStat{
			ID:          uuid.New(),
			CompanyID:   auth.CompanyID,
			MachineID:   machineID,
			Ts:          time.Now(),
			MetricKey:   metric,
			MetricValue: value,
			Meta:        map[string]any{"unit": units[metric], "simulated": true, "module_id": module.ID},
		}
		database.DB.Create(&stat)
		inserted++
		time.Sleep(interval)
	}

	return c.JSON(fiber.Map{
		"message":     "simulation complete",
		"inserted":    inserted,
		"seconds":     seconds,
		"rate":        rate,
		"machine_ids": machineIDs,
	})
}
