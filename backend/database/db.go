package database

import (
	"database/sql"
	"log"

	"github.com/companyuser/backend/config"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB
var RawDB *sql.DB // Direct SQL database connection

func Connect() {
	var err error
	DB, err = gorm.Open(postgres.Open(config.Cfg.DatabaseURL), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		PrepareStmt:                              false, // Disable prepared statement caching
		DisableForeignKeyConstraintWhenMigrating: true,
		DisableAutomaticPing:                     true, // Disable automatic ping
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Get direct SQL database connection
	RawDB, err = DB.DB()
	if err != nil {
		log.Fatalf("Failed to get raw database connection: %v", err)
	}

	// Configure connection pool for single connection to prevent statement conflicts
	RawDB.SetMaxOpenConns(1)    // Single connection to prevent conflicts
	RawDB.SetMaxIdleConns(1)    // Keep the single connection idle
	RawDB.SetConnMaxLifetime(0) // Don't expire connections
	RawDB.SetConnMaxIdleTime(0) // Never close idle connections

	// Create branches table using raw SQL to avoid prepared statement conflicts
	log.Println("Checking and creating branches table...")

	// Create branches table if it doesn't exist
	createBranchTableSQL := `
	CREATE TABLE IF NOT EXISTS branches (
		id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
		company_id UUID NOT NULL REFERENCES companies(id),
		name VARCHAR(255) NOT NULL,
		code VARCHAR(100) NOT NULL,
		address TEXT,
		city VARCHAR(100),
		state VARCHAR(100),
		pincode VARCHAR(10),
		phone VARCHAR(20),
		email VARCHAR(255),
		status VARCHAR(50) DEFAULT 'active',
		created_at TIMESTAMP DEFAULT NOW(),
		updated_at TIMESTAMP DEFAULT NOW()
	);`

	if err := DB.Exec(createBranchTableSQL).Error; err != nil {
		log.Printf("Warning: Failed to create branches table (may already exist): %v", err)
	} else {
		log.Println("Branches table created/verified successfully")
	}

	// Add branch_id column to machines table if it doesn't exist
	addColumnSQL := `
	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns 
			WHERE table_name='machines' AND column_name='branch_id'
		) THEN
			ALTER TABLE machines ADD COLUMN branch_id UUID REFERENCES branches(id);
			RAISE NOTICE 'Added branch_id column to machines table';
		ELSE
			RAISE NOTICE 'branch_id column already exists in machines table';
		END IF;
	END $$;`

	if err := DB.Exec(addColumnSQL).Error; err != nil {
		log.Printf("Warning: Failed to add branch_id column (may already exist): %v", err)
	} else {
		log.Println("branch_id column checked/added successfully")
	}

	log.Println("Database migration completed")

	// Clear any existing prepared statements
	clearPreparedStatements()

	// Seed initial data
	SeedData()

	log.Println("Database connected")
}

// Clear any existing prepared statements to prevent conflicts
func clearPreparedStatements() {
	// Clear ALL prepared statements, not just cached ones
	if _, err := RawDB.Exec("DEALLOCATE ALL"); err != nil {
		log.Printf("Warning: Could not deallocate all statements: %v", err)
	} else {
		log.Println("Cleared all prepared statements")
	}
}
