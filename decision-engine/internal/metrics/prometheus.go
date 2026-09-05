// Package metrics is the Phase 10 lightweight engineering telemetry (PLAN.md §11): a handful of
// Prometheus metrics — request rate/latency/errors, recovery-pipeline throughput, AI-service
// availability, and DB/Redis health — exposed at GET /metrics in the Prometheus text format.
//
// It is intentionally minimal (a fraction of the effort the Section-10 product dashboard gets)
// and dependency-free (stdlib only), so it never affects the decision path or the build. A single
// package-level registry is used; all recorders are concurrency-safe and cheap.
package metrics

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"sync"
)

// durationBuckets are the histogram upper bounds (seconds) for request latency.
var durationBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

type registry struct {
	mu sync.Mutex
	// counters keyed by "name|k=v,k=v" → value
	counters map[string]float64
	// gauges keyed by name → value
	gauges map[string]float64
	// histogram state for request duration
	hCounts []uint64 // per-bucket cumulative counts (len == buckets)
	hSum    float64
	hTotal  uint64
}

var reg = &registry{
	counters: map[string]float64{},
	gauges:   map[string]float64{},
	hCounts:  make([]uint64, len(durationBuckets)),
}

func key(name, labels string) string {
	if labels == "" {
		return name
	}
	return name + "|" + labels
}

func (r *registry) incCounter(name, labels string, by float64) {
	r.mu.Lock()
	r.counters[key(name, labels)] += by
	r.mu.Unlock()
}

func (r *registry) setGauge(name string, v float64) {
	r.mu.Lock()
	r.gauges[name] = v
	r.mu.Unlock()
}

func (r *registry) observeDuration(seconds float64) {
	r.mu.Lock()
	for i, b := range durationBuckets {
		if seconds <= b {
			r.hCounts[i]++
		}
	}
	r.hSum += seconds
	r.hTotal++
	r.mu.Unlock()
}

// ---- Public recorders ----

// ObserveHTTP records one served request: its count (by method+code) and its latency.
func ObserveHTTP(method string, code int, seconds float64) {
	reg.incCounter("decision_engine_http_requests_total",
		fmt.Sprintf("method=%q,code=%q", method, strconv.Itoa(code)), 1)
	reg.observeDuration(seconds)
}

// RecordDecision counts one persisted decision by its policy result (ALLOW/BLOCK/HUMAN_REVIEW).
func RecordDecision(result string) {
	reg.incCounter("decision_engine_decisions_total", fmt.Sprintf("result=%q", result), 1)
}

// RecordDiagnosisSource counts one diagnosis by source ("llm" / "rule_based_fallback") — the
// AI-service availability signal (a rising fallback rate means the LLM plane is degraded).
func RecordDiagnosisSource(source string) {
	reg.incCounter("decision_engine_diagnoses_total", fmt.Sprintf("source=%q", source), 1)
}

// SetDBUp / SetRedisUp record dependency health as 1 (up) or 0 (down).
func SetDBUp(up bool)    { reg.setGauge("decision_engine_db_up", b2f(up)) }
func SetRedisUp(up bool) { reg.setGauge("decision_engine_redis_up", b2f(up)) }

func b2f(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// Handler renders the current metrics in Prometheus text exposition format.
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		reg.mu.Lock()
		defer reg.mu.Unlock()
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		// process up gauge (always 1 while serving).
		fmt.Fprintln(w, "# TYPE decision_engine_up gauge")
		fmt.Fprintln(w, "decision_engine_up 1")

		// counters
		names := sortedKeys(reg.counters)
		for _, k := range names {
			name, labels := splitKey(k)
			if labels == "" {
				fmt.Fprintf(w, "%s %g\n", name, reg.counters[k])
			} else {
				fmt.Fprintf(w, "%s{%s} %g\n", name, labels, reg.counters[k])
			}
		}

		// gauges
		gnames := sortedKeys(reg.gauges)
		for _, name := range gnames {
			fmt.Fprintf(w, "%s %g\n", name, reg.gauges[name])
		}

		// request duration histogram
		fmt.Fprintln(w, "# TYPE decision_engine_http_request_duration_seconds histogram")
		for i, b := range durationBuckets {
			fmt.Fprintf(w, "decision_engine_http_request_duration_seconds_bucket{le=%q} %d\n",
				strconv.FormatFloat(b, 'g', -1, 64), reg.hCounts[i])
		}
		fmt.Fprintf(w, "decision_engine_http_request_duration_seconds_bucket{le=\"+Inf\"} %d\n", reg.hTotal)
		fmt.Fprintf(w, "decision_engine_http_request_duration_seconds_sum %g\n", reg.hSum)
		fmt.Fprintf(w, "decision_engine_http_request_duration_seconds_count %d\n", reg.hTotal)
	}
}

func sortedKeys(m map[string]float64) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func splitKey(k string) (name, labels string) {
	for i := 0; i < len(k); i++ {
		if k[i] == '|' {
			return k[:i], k[i+1:]
		}
	}
	return k, ""
}
