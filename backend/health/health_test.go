package health

import (
	"math"
	"testing"
)

func f(v float64) *float64 { return &v }

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func TestStressUpperLimits(t *testing.T) {
	l := Limits{WarnMax: f(4.5), CritMax: f(7.1)} // vibration, band width 2.6
	cases := []struct {
		v, want float64
	}{
		{0, 0},     // more than one band below warning
		{1.9, 0},   // exactly one band below
		{4.5, 0.4}, // at warning
		{5.8, 0.6}, // half way warning → critical
		{7.1, 0.8}, // at critical
		{9.7, 1},   // one band past critical
		{20, 1},    // clamped
		{3.2, 0.2}, // half a band below warning
	}
	for _, c := range cases {
		if got := Stress(c.v, l); !near(got, c.want) {
			t.Errorf("Stress(%v) = %v, want %v", c.v, got, c.want)
		}
	}
}

func TestStressLowerAndSingleLimit(t *testing.T) {
	// power factor: lower limits only
	l := Limits{WarnMin: f(0.85), CritMin: f(0.80)}
	if s := Stress(0.95, l); s != 0 {
		t.Errorf("healthy PF stress = %v", s)
	}
	if s := Stress(0.80, l); !near(s, 0.8) {
		t.Errorf("PF at critical = %v", s)
	}
	// only a critical max: warning is synthesised 20 % below it
	only := Limits{CritMax: f(100)}
	if s := Stress(80, only); !near(s, 0.4) {
		t.Errorf("synthesised warning stress = %v, want 0.4", s)
	}
	// no limits → no stress
	if s := Stress(1e9, Limits{}); s != 0 {
		t.Errorf("no-limit stress = %v", s)
	}
}

func buckets(vals ...float64) []Bucket {
	out := make([]Bucket, len(vals))
	for i, v := range vals {
		out[i] = Bucket{Hours: float64(i - len(vals) + 1), Avg: v, Samples: 10, InLimits: 10}
	}
	return out
}

func TestScoreMetricHealthyAndFlat(t *testing.T) {
	r := ScoreMetric(MetricInput{
		Limits: Limits{WarnMax: f(4.5), CritMax: f(7.1)}, Latest: 1.5,
		Buckets: buckets(1.5, 1.5, 1.5, 1.5, 1.5),
	})
	if r.Score != 100 {
		t.Errorf("flat healthy score = %d, want 100", r.Score)
	}
	if r.HoursToLimit != nil {
		t.Errorf("flat trend should have no time to limit, got %v", *r.HoursToLimit)
	}
}

func TestScoreMetricRisingTrend(t *testing.T) {
	// rises 0.1 mm/s per hour, now 3.0 → critical 7.1 in 41 h
	r := ScoreMetric(MetricInput{
		Limits: Limits{WarnMax: f(4.5), CritMax: f(7.1)}, Latest: 3.0,
		Buckets: buckets(2.6, 2.7, 2.8, 2.9, 3.0),
	})
	if r.SlopePerHour == nil || !near(*r.SlopePerHour, 0.1) {
		t.Fatalf("slope = %v, want 0.1", r.SlopePerHour)
	}
	if r.HoursToLimit == nil || !near(*r.HoursToLimit, 41) {
		t.Fatalf("hours to limit = %v, want 41", r.HoursToLimit)
	}
	if r.Trend <= 0 {
		t.Errorf("rising trend should add stress, got %v", r.Trend)
	}
	if r.Score >= 100 || r.Score < 60 {
		t.Errorf("rising-trend score = %d, want somewhat below 100", r.Score)
	}
}

func TestScoreMetricOutOfLimits(t *testing.T) {
	bs := buckets(8, 8, 8, 8)
	for i := range bs {
		bs[i].InLimits = 0
	}
	r := ScoreMetric(MetricInput{Limits: Limits{WarnMax: f(4.5), CritMax: f(7.1)}, Latest: 8, Buckets: bs})
	if r.OutOfLimitsPct != 100 {
		t.Errorf("out of limits = %v", r.OutOfLimitsPct)
	}
	if r.HoursToLimit == nil || *r.HoursToLimit != 0 {
		t.Errorf("already past limit → 0 hours, got %v", r.HoursToLimit)
	}
	if r.Score > 40 {
		t.Errorf("breached metric score = %d, want ≤ 40", r.Score)
	}
}

func TestMachineScoreAndCaps(t *testing.T) {
	if _, ok := MachineScore(nil, 0, 0); ok {
		t.Error("no metrics should give no score")
	}
	s, _ := MachineScore([]int{90, 60}, 0, 0) // 0.6*60 + 0.4*75 = 66
	if s != 66 {
		t.Errorf("combined = %d, want 66", s)
	}
	if s, _ := MachineScore([]int{100}, 1, 0); s != 45 {
		t.Errorf("critical cap = %d", s)
	}
	if s, _ := MachineScore([]int{100}, 0, 2); s != 75 {
		t.Errorf("warning cap = %d", s)
	}
	if Status(80) != "good" || Status(79) != "watch" || Status(49) != "critical" {
		t.Error("status bands wrong")
	}
}
