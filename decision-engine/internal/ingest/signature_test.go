package ingest

import "testing"

func TestSignature_RoundTrip(t *testing.T) {
	body := []byte(`{"external_event_id":"evt_1","amount":15000}`)
	secret := "whsec_test"

	sig := ComputeSignature(body, secret)
	if !VerifySignature(body, sig, secret) {
		t.Fatal("expected valid signature to verify")
	}
	if !VerifySignature(body, "sha256="+sig, secret) {
		t.Fatal("expected sha256= prefixed signature to verify")
	}
}

func TestSignature_Rejections(t *testing.T) {
	body := []byte(`{"external_event_id":"evt_1"}`)
	secret := "whsec_test"
	good := ComputeSignature(body, secret)

	cases := []struct {
		name   string
		body   []byte
		header string
		secret string
	}{
		{"wrong secret", body, good, "whsec_WRONG"},
		{"tampered body", []byte(`{"external_event_id":"evt_2"}`), good, secret},
		{"empty secret", body, good, ""},
		{"empty header", body, "", secret},
		{"malformed hex", body, "zzzz", secret},
		{"length mismatch", body, "abcd", secret}, // valid hex, wrong digest length
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if VerifySignature(tc.body, tc.header, tc.secret) {
				t.Fatalf("expected signature to be rejected: %s", tc.name)
			}
		})
	}
}
