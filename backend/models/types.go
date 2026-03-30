package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// JSONB custom type for PostgreSQL JSONB
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes value into JSONB")
	}
	
	return json.Unmarshal(bytes, j)
}
