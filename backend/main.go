package main

import (
	"github.com/companyuser/backend/alerts"
	"github.com/companyuser/backend/health"
	"log"

	"github.com/companyuser/backend/config"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/handlers"
	"github.com/companyuser/backend/hub"
	"github.com/companyuser/backend/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
)

func main() {
	config.Load()
	database.Connect()

	// Initialise WebSocket hub and OPC UA simulator
	hub.GlobalHub = hub.NewHub()
	go hub.GlobalHub.Run()

	// Limit-breach alert engine (evaluates readings from every ingest path)
	alerts.Start()

	// Hourly health-score history (machine_health_snapshots)
	health.StartSnapshots()

	// Expert Guided Remote Maintenance (Remote Camera) moved to a separate site.
	// WebRTC signaling hub for the Remote Camera feature
	// hub.GlobalSignaling = hub.NewSignalingHub()
	// go hub.GlobalSignaling.Run()

	// Demo data: simulated live values for every machine until the client
	// approves the OPC UA gateway. Turn off with SIMULATOR_ENABLED=false.
	if config.Cfg.SimulatorEnabled {
		StartOPCUASimulator()
	} else {
		log.Println("[SIM] disabled (SIMULATOR_ENABLED=false)")
	}

	// Start real OPC UA client for machine data ingestion
	// Disabled - server endpoint not accessible
	// go StartOPCUAClient()

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
		ReadBufferSize:  10240, // 10KB for WebSocket messages
		WriteBufferSize: 10240, // 10KB for WebSocket messages
	})

	// WebSocket routes — register FIRST, before ALL middleware
	app.Get("/ws", websocket.New(hub.ServeWS))
	// WebRTC signaling for the Remote Camera feature (room-based relay)
	// Disabled: Expert Guided Remote Maintenance moved to a separate site.
	// app.Get("/rtc", websocket.New(hub.ServeSignaling))

	app.Use(recover.New())
	app.Use(logger.New())

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowCredentials: false,
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// WebSocket test endpoint
	app.Get("/ws-test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message":         "WebSocket endpoint is at /ws?machine_id=all",
			"test_with_wscat": "wscat -c ws://localhost:8080/ws?machine_id=all",
		})
	})

	// Legacy OPC UA batch ingest — now requires a gateway API key
	app.Post("/opcua/ingest", middleware.GatewayAuth(), handlers.IngestOPCUAData)

	// OPC UA edge gateways (API-key auth, see gateway/README.md)
	gw := app.Group("/gateway/v1", middleware.GatewayAuth())
	gw.Get("/config", handlers.GatewayConfig)
	gw.Post("/ingest", handlers.GatewayIngest)
	gw.Post("/status", handlers.GatewayStatus)

	// WebRTC ICE servers (public — the camera page is unauthenticated)
	// Disabled: Expert Guided Remote Maintenance moved to a separate site.
	// app.Get("/webrtc/ice", handlers.GetICEServers)

	// ── Protected API routes ──────────────────────────────────────────────────
	api := app.Group("/api/v1", middleware.JWTAuth(config.Cfg.JWTSecret))

	// Auth routes
	api.Post("/auth/change-password", handlers.ChangePassword)

	// Dashboard
	api.Get("/dashboard/summary", handlers.GetDashboardSummary)
	api.Get("/dashboard/overview", handlers.GetDashboardOverview)
	api.Get("/predictive/health", handlers.GetPredictiveHealth)
	api.Get("/predictive/health/history", handlers.GetPredictiveHealthHistory)
	// Backfill runs in a background goroutine, so it is only registered on the
	// long-running server (not the Vercel adapter).
	api.Post("/predictive/health/backfill", middleware.RequirePermission("superadmin"), handlers.StartHealthBackfill)
	api.Get("/predictive/health/backfill", middleware.RequirePermission("superadmin"), handlers.GetHealthBackfillStatus)

	// Alerts (limit breaches), scoped to the machines the caller can monitor
	api.Get("/alerts", handlers.ListAlerts)
	api.Post("/alerts/:id/acknowledge", handlers.AcknowledgeAlert)

	// Historical reading logs (time-range queries + CSV export), scoped like alerts
	api.Get("/logs/readings", handlers.ListReadingLogs)
	api.Get("/logs/readings/export", handlers.ExportReadingLogs)

	// OPC UA edge gateways (admin) and per-machine node mapping
	api.Get("/gateways", handlers.ListGateways)
	api.Post("/gateways", middleware.RequirePermission("machines.write"), handlers.CreateGateway)
	api.Put("/gateways/:id", middleware.RequirePermission("machines.write"), handlers.UpdateGateway)
	api.Post("/gateways/:id/rotate-key", middleware.RequirePermission("machines.write"), handlers.RotateGatewayKey)
	api.Delete("/gateways/:id", middleware.RequirePermission("machines.write"), handlers.DeleteGateway)
	api.Get("/machines/:id/opcua", handlers.GetMachineOPCUA)
	api.Put("/machines/:id/opcua", middleware.RequirePermission("machines.write"), handlers.UpdateMachineOPCUA)

	// Companies (superadmin only)
	api.Get("/companies", middleware.RequirePermission("superadmin"), handlers.ListCompanies)
	api.Get("/companies/:id", middleware.RequirePermission("superadmin"), handlers.GetCompany)
	api.Post("/companies", middleware.RequirePermission("companies.write"), handlers.CreateCompany)
	api.Put("/companies/:id", middleware.RequirePermission("companies.write"), handlers.UpdateCompany)
	api.Delete("/companies/:id", middleware.RequirePermission("companies.write"), handlers.DeleteCompany)
	api.Get("/companies/:id/stats", middleware.RequirePermission("superadmin"), handlers.GetCompanyStats)

	// Branches
	api.Get("/branches", handlers.ListBranches)
	api.Get("/branches/:id", handlers.GetBranch)
	api.Post("/branches", middleware.RequirePermission("branches.write"), handlers.CreateBranch)
	api.Put("/branches/:id", middleware.RequirePermission("branches.write"), handlers.UpdateBranch)
	api.Delete("/branches/:id", middleware.RequirePermission("branches.write"), handlers.DeleteBranch)

	// Subdivisions
	api.Get("/subdivisions", handlers.ListSubdivisions)
	api.Get("/subdivisions/:id", handlers.GetSubdivision)
	api.Post("/subdivisions", middleware.RequirePermission("subdivisions.write"), handlers.CreateSubdivision)
	api.Put("/subdivisions/:id", middleware.RequirePermission("subdivisions.write"), handlers.UpdateSubdivision)
	api.Delete("/subdivisions/:id", middleware.RequirePermission("subdivisions.write"), handlers.DeleteSubdivision)

	// Modules
	api.Get("/modules/active", handlers.ListActiveModules)
	api.Get("/modules", handlers.ListModules)
	api.Get("/modules/:id", handlers.GetModule)
	api.Put("/modules/:id/toggle", handlers.InvalidateAlertRules, handlers.ToggleModule)
	api.Get("/modules/:id/metrics", handlers.ListModuleMetrics)
	api.Post("/modules/:id/metrics", handlers.CreateModuleMetric)
	api.Put("/modules/:id/metrics/:metric_id", handlers.UpdateModuleMetric)
	api.Delete("/modules/:id/metrics/:metric_id", handlers.InvalidateAlertRules, handlers.DeleteModuleMetric)

	// Machines
	api.Get("/machines", handlers.ListMachines)
	api.Get("/machines/:id", handlers.GetMachine)
	api.Post("/machines", middleware.RequirePermission("machines.write"), handlers.CreateMachine)
	api.Put("/machines/:id", middleware.RequirePermission("machines.write"), handlers.InvalidateAlertRules, handlers.UpdateMachine)
	api.Delete("/machines/:id", middleware.RequirePermission("machines.write"), handlers.DeleteMachine)
	api.Get("/machines/:id/stats", handlers.GetMachineStats)
	api.Post("/machines/:id/stats", middleware.RequirePermission("stats.write"), handlers.IngestMachineStat)
	api.Get("/machines/:id/users", handlers.GetMachineUsers)
	api.Post("/machines/:id/users", middleware.RequirePermission("machines.write"), handlers.AssignUserToMachine)
	api.Delete("/machines/:id/users/:user_id", middleware.RequirePermission("machines.write"), handlers.UnassignUserFromMachine)
	api.Get("/machines/:id/modules", handlers.GetMachineModules)
	api.Post("/machines/:id/modules", middleware.RequirePermission("machines.write"), handlers.InvalidateAlertRules, handlers.AssignModuleToMachine)
	api.Delete("/machines/:id/modules/:module_id", middleware.RequirePermission("machines.write"), handlers.InvalidateAlertRules, handlers.UnassignModuleFromMachine)

	// Users
	api.Get("/users/me", handlers.GetMe)
	api.Get("/users", handlers.ListUsers)
	api.Get("/users/:id", handlers.GetUser)
	api.Post("/users", middleware.RequirePermission("users.write"), handlers.CreateUser)
	api.Put("/users/:id", middleware.RequirePermission("users.write"), handlers.UpdateUser)
	api.Delete("/users/:id", middleware.RequirePermission("users.write"), handlers.DeleteUser)

	// Roles & permissions (mock implementations)
	api.Get("/roles", handlers.ListRoles)
	api.Post("/roles", middleware.RequirePermission("roles.write"), handlers.CreateRole)
	api.Put("/roles/:id", middleware.RequirePermission("roles.write"), handlers.UpdateRole)
	api.Delete("/roles/:id", middleware.RequirePermission("roles.write"), handlers.DeleteRole)
	api.Get("/permissions", handlers.ListPermissions)

	// Assignments
	api.Post("/assignments/roles", middleware.RequirePermission("roles.write"), handlers.AssignRole)
	api.Delete("/assignments/roles", middleware.RequirePermission("roles.write"), handlers.UnassignRole)
	api.Post("/assignments/machines", middleware.RequirePermission("machines.write"), handlers.AssignMachine)
	api.Delete("/assignments/machines", middleware.RequirePermission("machines.write"), handlers.UnassignMachine)

	// Dev simulator (admin only)
	api.Post("/dev/simulate", middleware.RequirePermission("stats.write"), handlers.Simulate)

	port := config.Cfg.Port
	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
