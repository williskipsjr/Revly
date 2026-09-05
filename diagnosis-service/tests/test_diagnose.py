"""Offline unit tests for the diagnosis classifier core and contract.

Constraints this suite respects (see build-environment memory):
  - no pytest  → stdlib unittest, runnable with `python -m unittest`.
  - no httpx   → no FastAPI TestClient; we test the pure `run_diagnosis` core and the
                 endpoint's error mapping is a thin try/except over it.
  - no anthropic → the LLM SDK is never imported; every test injects a fake `complete`.

Run from the diagnosis-service directory:
    ./.venv/bin/python -m unittest discover -s tests -v
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

# Make the service modules (main, schema, llm_client) importable regardless of cwd.
SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

from pydantic import ValidationError  # noqa: E402

import main  # noqa: E402  (import proves the module loads without the anthropic SDK present)
from llm_client import LLMError, is_configured  # noqa: E402
from schema import (  # noqa: E402
    Action,
    DiagnoseRequest,
    Diagnosis,
    RootCause,
    SCHEMA_VERSION,
    diagnosis_tool,
)

VALID_TOOL_INPUT = {
    "root_cause": "temporary_bank_decline",
    "confidence": 0.6,
    "rationale": "Transient issuer decline; a delayed retry may clear.",
    "candidate_actions": ["delayed_retry", "retry", "no_action"],
}


def fake_complete(output):
    """Return a completion callable that ignores its prompt and yields `output`."""

    def _complete(system, user, tool):  # noqa: ANN001
        return output

    return _complete


def raising_complete(exc):
    def _complete(system, user, tool):  # noqa: ANN001
        raise exc

    return _complete


class RunDiagnosisSuccess(unittest.TestCase):
    def test_valid_output_becomes_schema_valid_diagnosis(self):
        req = DiagnoseRequest(
            event_type="payment.failed",
            failure_reason="Issuer declined",
            method="card",
            prior_attempts=1,
            payment_event_id="pe_42",
        )
        diag = main.run_diagnosis(req, fake_complete(VALID_TOOL_INPUT), model_version="claude-sonnet-5")

        self.assertIsInstance(diag, Diagnosis)
        self.assertEqual(diag.schema_version, SCHEMA_VERSION)
        self.assertEqual(diag.root_cause, RootCause.TEMPORARY_BANK_DECLINE)
        self.assertEqual(diag.source, "llm")  # service stamps provenance, not the model
        self.assertEqual(diag.model_version, "claude-sonnet-5")
        self.assertEqual(diag.payment_event_id, "pe_42")
        self.assertIsNotNone(diag.created_at)
        self.assertGreaterEqual(diag.confidence, 0.0)
        self.assertLessEqual(diag.confidence, 1.0)
        self.assertTrue(diag.candidate_actions)

    def test_produced_diagnosis_matches_frozen_json_schema(self):
        req = DiagnoseRequest(event_type="payment.failed", failure_reason="declined")
        diag = main.run_diagnosis(req, fake_complete(VALID_TOOL_INPUT), model_version="m1")
        _assert_matches_contract(self, diag.model_dump())


class RunDiagnosisFallbackPaths(unittest.TestCase):
    """Every malformed/failing case must raise (→ endpoint non-2xx → Go rule-based fallback)."""

    def setUp(self):
        self.req = DiagnoseRequest(event_type="payment.failed", failure_reason="declined")

    def test_transport_error_propagates(self):
        with self.assertRaises(LLMError):
            main.run_diagnosis(self.req, raising_complete(LLMError("boom")), model_version="m1")

    def test_unknown_root_cause_rejected(self):
        bad = {**VALID_TOOL_INPUT, "root_cause": "aliens"}
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")

    def test_missing_rationale_rejected(self):
        bad = {k: v for k, v in VALID_TOOL_INPUT.items() if k != "rationale"}
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")

    def test_empty_rationale_rejected(self):
        bad = {**VALID_TOOL_INPUT, "rationale": ""}
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")

    def test_empty_candidate_actions_rejected(self):
        bad = {**VALID_TOOL_INPUT, "candidate_actions": []}
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")

    def test_unknown_action_rejected(self):
        bad = {**VALID_TOOL_INPUT, "candidate_actions": ["retry", "teleport"]}
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")

    def test_confidence_out_of_range_rejected(self):
        bad = {**VALID_TOOL_INPUT, "confidence": 1.7}
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")

    def test_extra_field_rejected(self):
        bad = {**VALID_TOOL_INPUT, "p_success": 0.9}  # LLM must never emit a probability field
        with self.assertRaises(ValidationError):
            main.run_diagnosis(self.req, fake_complete(bad), model_version="m1")


class ContractAndConfig(unittest.TestCase):
    def test_request_rejects_unknown_fields(self):
        with self.assertRaises(ValidationError):
            DiagnoseRequest(event_type="payment.failed", amount=5000)

    def test_request_requires_event_type(self):
        with self.assertRaises(ValidationError):
            DiagnoseRequest(event_type="")

    def test_tool_schema_enumerates_contract_vocab(self):
        tool = diagnosis_tool()
        props = tool["input_schema"]["properties"]
        self.assertEqual(set(props["root_cause"]["enum"]), {c.value for c in RootCause})
        self.assertEqual(set(props["candidate_actions"]["items"]["enum"]), {a.value for a in Action})
        # The tool must not let the model emit a probability or an amount.
        self.assertNotIn("p_success", props)
        self.assertNotIn("amount", props)

    def test_is_configured_reflects_env(self):
        import os

        saved = (os.environ.get("ANTHROPIC_AUTH_TOKEN"), os.environ.get("ANTHROPIC_API_KEY"))
        try:
            os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)
            os.environ.pop("ANTHROPIC_API_KEY", None)
            self.assertFalse(is_configured())
            os.environ["ANTHROPIC_API_KEY"] = "test-key"
            self.assertTrue(is_configured())
        finally:
            for key, val in zip(("ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"), saved):
                if val is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = val


def _assert_matches_contract(tc: unittest.TestCase, doc: dict) -> None:
    """Lightweight validation against schemas/diagnosis.schema.json (no jsonschema dep)."""
    schema_path = SERVICE_DIR.parent / "schemas" / "diagnosis.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    allowed = set(schema["properties"].keys())
    for key in doc:
        tc.assertIn(key, allowed, f"additionalProperties:false violated by {key!r}")
    for key in schema["required"]:
        tc.assertIn(key, doc, f"required key {key!r} missing")

    tc.assertEqual(doc["schema_version"], schema["properties"]["schema_version"]["const"])
    tc.assertIn(doc["root_cause"], schema["properties"]["root_cause"]["enum"])
    action_enum = schema["$defs"]["action"]["enum"]
    tc.assertTrue(doc["candidate_actions"])
    for act in doc["candidate_actions"]:
        tc.assertIn(act, action_enum)
    tc.assertGreaterEqual(doc["confidence"], schema["properties"]["confidence"]["minimum"])
    tc.assertLessEqual(doc["confidence"], schema["properties"]["confidence"]["maximum"])
    tc.assertIn(doc["source"], schema["properties"]["source"]["enum"])
    tc.assertTrue(doc["rationale"])


if __name__ == "__main__":
    unittest.main()
