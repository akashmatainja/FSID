// Package health computes the predictive-maintenance health score.
//
// The score is deliberately explainable. For every metric that has limits:
//
//	metric score = 100 × (1 − (0.5·condition + 0.3·outOfLimits + 0.2·trend))
//
//	condition    stress of the latest reading, 0 (healthy) … 1 (far past critical)
//	outOfLimits  share of readings in the window that were outside the limits
//	trend        how much worse the stress gets if the current linear trend
//	             continues for 24 h (0 when flat or improving)
//
// The machine score leans towards its worst metric (0.6·min + 0.4·mean) and
// is capped by open alerts: ≤ 45 with a critical alert, ≤ 75 with a warning.
//
// The same trend line gives HoursToLimit: when the fitted line would cross the
// critical limit (or the warning limit if no critical one is set).
package health

import "math"

// Weights for the metric score components.
const (
	WeightCondition = 0.5
	WeightOutOfLims = 0.3
	WeightTrend     = 0.2

	TrendHorizonHours = 24.0
	MaxHorizonHours   = 24.0 * 90 // beyond this the trend is reported as stable
	MinTrendBuckets   = 4
)

// Limits mirrors module_metrics limits; nil = not set.
type Limits struct {
	WarnMin, WarnMax, CritMin, CritMax *float64
}

func (l Limits) Any() bool {
	return l.WarnMin != nil || l.WarnMax != nil || l.CritMin != nil || l.CritMax != nil
}

// band returns the (warn, crit) pair for one side, filling a missing value
// with a band 20 % of the magnitude away so a single limit still works.
func band(warn, crit *float64, upper bool) (w, c float64, ok bool) {
	switch {
	case warn == nil && crit == nil:
		return 0, 0, false
	case warn != nil && crit != nil:
		return *warn, *crit, true
	case crit != nil:
		d := gap(*crit)
		if upper {
			return *crit - d, *crit, true
		}
		return *crit + d, *crit, true
	default:
		d := gap(*warn)
		if upper {
			return *warn, *warn + d, true
		}
		return *warn, *warn - d, true
	}
}

func gap(v float64) float64 {
	if g := math.Abs(v) * 0.2; g > 0 {
		return g
	}
	return 1
}

// Stress maps a value to 0…1 against the limits:
//
//	well inside the warning limit → 0
//	approaching the warning limit → 0 … 0.4
//	between warning and critical  → 0.4 … 0.8
//	past critical                 → 0.8 … 1
func Stress(v float64, l Limits) float64 {
	return math.Max(sideStress(v, l.WarnMax, l.CritMax, true), sideStress(v, l.WarnMin, l.CritMin, false))
}

func sideStress(v float64, warn, crit *float64, upper bool) float64 {
	w, c, ok := band(warn, crit, upper)
	if !ok {
		return 0
	}
	width := math.Abs(c - w)
	if width == 0 {
		width = gap(c)
	}
	// distance past the warning limit, positive towards critical
	d := v - w
	if !upper {
		d = w - v
	}
	switch {
	case d <= -width: // more than one band inside the warning limit
		return 0
	case d <= 0:
		return 0.4 * (1 + d/width)
	case d <= width:
		return 0.4 + 0.4*d/width
	default:
		return math.Min(1, 0.8+0.2*(d-width)/width)
	}
}

// Bucket is an aggregated slice of readings (e.g. one hour).
type Bucket struct {
	Hours    float64 // bucket midpoint, hours relative to "now" (≤ 0)
	Avg      float64
	Samples  int64
	InLimits int64
}

// MetricInput is everything needed to score one metric.
type MetricInput struct {
	Limits  Limits
	Latest  float64
	Buckets []Bucket
}

// MetricResult explains one metric's score.
type MetricResult struct {
	Score          int      `json:"score"`
	Condition      float64  `json:"condition"`         // 0…1
	OutOfLimitsPct float64  `json:"out_of_limits_pct"` // 0…100
	Trend          float64  `json:"trend"`             // 0…1
	SlopePerHour   *float64 `json:"slope_per_hour"`    // nil when not enough data
	HoursToLimit   *float64 `json:"hours_to_limit"`    // nil when not trending towards a limit
	Projected24h   *float64 `json:"projected_24h"`
}

// ScoreMetric computes the explainable score for one metric.
func ScoreMetric(in MetricInput) MetricResult {
	var r MetricResult
	r.Condition = Stress(in.Latest, in.Limits)

	var n, inL int64
	for _, b := range in.Buckets {
		n += b.Samples
		inL += b.InLimits
	}
	out := 0.0
	if n > 0 {
		out = 1 - float64(inL)/float64(n)
	}
	r.OutOfLimitsPct = round1(out * 100)

	if slope, fitNow, ok := fit(in.Buckets); ok {
		s := slope
		p := fitNow + slope*TrendHorizonHours
		r.SlopePerHour = &s
		r.Projected24h = &p
		r.Trend = clamp01(2 * (Stress(p, in.Limits) - Stress(fitNow, in.Limits)))
		r.HoursToLimit = hoursToLimit(in.Latest, fitNow, slope, in.Limits)
	}

	r.Score = int(math.Round(100 * clamp01(1-(WeightCondition*r.Condition+WeightOutOfLims*out+WeightTrend*r.Trend))))
	return r
}

// fit is a sample-weighted least-squares line through bucket averages.
// Returns the slope (units/hour) and the fitted value at "now" (hours = 0).
func fit(bs []Bucket) (slope, atNow float64, ok bool) {
	if len(bs) < MinTrendBuckets {
		return 0, 0, false
	}
	var sw, sx, sy, sxx, sxy float64
	for _, b := range bs {
		w := float64(b.Samples)
		if w <= 0 {
			continue
		}
		sw += w
		sx += w * b.Hours
		sy += w * b.Avg
		sxx += w * b.Hours * b.Hours
		sxy += w * b.Hours * b.Avg
	}
	den := sw*sxx - sx*sx
	if sw == 0 || den == 0 {
		return 0, 0, false
	}
	slope = (sw*sxy - sx*sy) / den
	atNow = (sy - slope*sx) / sw
	return slope, atNow, true
}

// hoursToLimit: time until the trend line reaches the critical limit (warning
// limit when no critical is set) on the side it is heading towards.
func hoursToLimit(latest, atNow, slope float64, l Limits) *float64 {
	zero := 0.0
	upper := pick(l.CritMax, l.WarnMax)
	lower := pick(l.CritMin, l.WarnMin)
	if (upper != nil && latest >= *upper) || (lower != nil && latest <= *lower) {
		return &zero
	}
	var h float64
	switch {
	case slope > 0 && upper != nil:
		h = (*upper - atNow) / slope
	case slope < 0 && lower != nil:
		h = (atNow - *lower) / -slope
	default:
		return nil
	}
	if h < 0 {
		return &zero
	}
	if h > MaxHorizonHours {
		return nil
	}
	h = round1(h)
	return &h
}

func pick(a, b *float64) *float64 {
	if a != nil {
		return a
	}
	return b
}

// MachineScore combines metric scores and applies alert caps.
func MachineScore(metricScores []int, openCritical, openWarning int64) (int, bool) {
	if len(metricScores) == 0 {
		return 0, false
	}
	minS, sum := 100, 0
	for _, s := range metricScores {
		sum += s
		if s < minS {
			minS = s
		}
	}
	mean := float64(sum) / float64(len(metricScores))
	score := int(math.Round(0.6*float64(minS) + 0.4*mean))
	if openCritical > 0 && score > 45 {
		score = 45
	} else if openWarning > 0 && score > 75 {
		score = 75
	}
	return score, true
}

// Status buckets a score: good ≥ 80, watch ≥ 50, critical below.
func Status(score int) string {
	switch {
	case score >= 80:
		return "good"
	case score >= 50:
		return "watch"
	default:
		return "critical"
	}
}

func clamp01(v float64) float64 { return math.Max(0, math.Min(1, v)) }
func round1(v float64) float64  { return math.Round(v*10) / 10 }
