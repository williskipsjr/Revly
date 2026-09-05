package metrics

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// TestHandler_RendersRecordedMetrics: recorders update the registry and the handler renders them
// in Prometheus text format (used by the Phase-10 Grafana dashboard).
func TestHandler_RendersRecordedMetrics(t *testing.T) {
	ObserveHTTP("GET", 200, 0.012)
	RecordDecision("ALLOW")
	RecordDiagnosisSource("rule_based_fallback")
	SetDBUp(true)
	SetRedisUp(false)

	rec := httptest.NewRecorder()
	Handler()(rec, httptest.NewRequest("GET", "/metrics", nil))
	body := rec.Body.String()

	for _, want := range []string{
		"decision_engine_up 1",
		"decision_engine_http_requests_total{",
		"decision_engine_decisions_total{result=\"ALLOW\"}",
		"decision_engine_diagnoses_total{source=\"rule_based_fallback\"}",
		"decision_engine_db_up 1",
		"decision_engine_redis_up 0",
		"decision_engine_http_request_duration_seconds_bucket{",
		"decision_engine_http_request_duration_seconds_count",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("metrics output missing %q\n---\n%s", want, body)
		}
	}
}
