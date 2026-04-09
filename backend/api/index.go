package handler

import (
	"net/http"

	"github.com/companyuser/backend/config"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/handlers"
	"github.com/companyuser/backend/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/valyala/fasthttp"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

var app *fiber.App

func init() {
	config.Load()
	database.Connect()

	app = fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// ── Protected API routes ──────────────────────────────────────────────────
	api := app.Group("/api/v1", middleware.JWTAuth(config.Cfg.JWTSecret))

	// Auth routes
	api.Post("/auth/change-password", handlers.ChangePassword)

	// Dashboard
	api.Get("/dashboard/summary", handlers.GetDashboardSummary)

	// Companies (superadmin only)
	api.Get("/companies", middleware.RequirePermission("superadmin"), handlers.ListCompanies)
	api.Get("/companies/:id", middleware.RequirePermission("superadmin"), handlers.GetCompany)
	api.Post("/companies", middleware.RequirePermission("companies.write"), handlers.CreateCompany)
	api.Put("/companies/:id", middleware.RequirePermission("companies.write"), handlers.UpdateCompany)
	api.Delete("/companies/:id", middleware.RequirePermission("companies.write"), handlers.DeleteCompany)
	api.Get("/companies/:id/stats", middleware.RequirePermission("superadmin"), handlers.GetCompanyStats)

	// Machines
	api.Get("/machines", handlers.ListMachines)
	api.Get("/machines/:id", handlers.GetMachine)
	api.Post("/machines", middleware.RequirePermission("machines.write"), handlers.CreateMachine)
	api.Put("/machines/:id", middleware.RequirePermission("machines.write"), handlers.UpdateMachine)
	api.Delete("/machines/:id", middleware.RequirePermission("machines.write"), handlers.DeleteMachine)
	api.Get("/machines/:id/stats", handlers.GetMachineStats)
	api.Post("/machines/:id/stats", middleware.RequirePermission("stats.write"), handlers.IngestMachineStat)
	api.Get("/machines/:id/users", handlers.GetMachineUsers)
	api.Post("/machines/:id/users", middleware.RequirePermission("machines.write"), handlers.AssignUserToMachine)
	api.Delete("/machines/:id/users/:user_id", middleware.RequirePermission("machines.write"), handlers.UnassignUserFromMachine)

	// Users
	api.Get("/users/me", handlers.GetMe)
	api.Get("/users", handlers.ListUsers)
	api.Get("/users/:id", handlers.GetUser)
	api.Post("/users", middleware.RequirePermission("users.write"), handlers.CreateUser)
	api.Put("/users/:id", middleware.RequirePermission("users.write"), handlers.UpdateUser)
	api.Delete("/users/:id", middleware.RequirePermission("users.write"), handlers.DeleteUser)

	// Roles & permissions
	api.Get("/roles", handlers.ListRoles)
	api.Post("/roles", middleware.RequirePermission("roles.write"), handlers.CreateRole)
	api.Put("/roles/:id", middleware.RequirePermission("roles.write"), handlers.UpdateRole)
	api.Delete("/roles/:id", middleware.RequirePermission("roles.write"), handlers.DeleteRole)
	api.Get("/permissions", handlers.ListPermissions)

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

	// Modules (superadmin only)
	api.Get("/modules", handlers.ListModules)
	api.Get("/modules/:id", handlers.GetModule)
	api.Post("/modules", handlers.CreateModule)
	api.Put("/modules/:id", handlers.UpdateModule)
	api.Delete("/modules/:id", handlers.DeleteModule)

	// Assignments
	api.Post("/assignments/roles", middleware.RequirePermission("roles.write"), handlers.AssignRole)
	api.Delete("/assignments/roles", middleware.RequirePermission("roles.write"), handlers.UnassignRole)
	api.Post("/assignments/machines", middleware.RequirePermission("machines.write"), handlers.AssignMachine)
	api.Delete("/assignments/machines", middleware.RequirePermission("machines.write"), handlers.UnassignMachine)

	// Dev simulator (admin only)
	api.Post("/dev/simulate", middleware.RequirePermission("stats.write"), handlers.Simulate)
}

// Handler is the serverless function entry point for Vercel
func Handler(w http.ResponseWriter, r *http.Request) {
	// Convert net/http request to fasthttp request
	ctx := &fasthttp.RequestCtx{}
	fasthttpadaptor.ConvertRequest(ctx, r, true)

	// Call the Fiber app handler
	app.Handler()(ctx)

	// Copy fasthttp response to net/http response
	w.WriteHeader(ctx.Response.StatusCode())
	w.Write(ctx.Response.Body())
}
