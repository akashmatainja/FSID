package handlers

import "github.com/companyuser/backend/models"

// machineScope returns a SQL condition (without leading AND) restricting rows
// to the machines the caller may monitor, plus its args. Empty = no restriction.
//
//   - superadmin       → everything
//   - stats.read_all   → every machine in the caller's company
//   - otherwise        → only machines assigned to the caller
//
// The frontend's ModuleAccessProvider applies the same rule.
func machineScope(auth *models.AuthContext, machineCol, companyCol string) (string, []any) {
	if auth.Permissions["superadmin"] {
		return "", nil
	}
	if auth.Permissions["stats.read_all"] {
		return companyCol + " = ?", []any{auth.CompanyID}
	}
	return companyCol + " = ? AND " + machineCol +
			" IN (SELECT machine_id FROM machine_assignments WHERE user_id = ?)",
		[]any{auth.CompanyID, auth.CompanyUser.ID}
}
