"""Diagnosis contract types and the LLM tool schema (Intelligence plane, Phase 4).

Everything here mirrors ``schemas/diagnosis.schema.json`` — the frozen cross-plane
contract — so the service's output validates against it byte-for-byte. The module has NO
third-party dependency beyond pydantic and imports nothing from the LLM SDK, so the request/
response validation and the tool-schema builder are unit-testable offline (the sandbox has no
network and no ``anthropic`` package).

Two invariants from PLAN.md §5/§7 are enforced here by construction:
  - ``confidence`` is a GATING signal only (0..1); it is NEVER the P(success) used in ERV.
    Nothing in this service computes P(success).
  - the LLM only *proposes* a diagnosis + candidate actions; it never selects the executed
    action, never touches an amount, and never bypasses the Go policy plane. The Go decision
    plane re-ranks and authorises.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = "0.1.0"


class RootCause(str, Enum):
    """The diagnosable failure causes — mirrors schemas/diagnosis.schema.json #/root_cause."""

    TEMPORARY_BANK_DECLINE = "temporary_bank_decline"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    EXPIRED_METHOD = "expired_method"
    CHECKOUT_ABANDONMENT = "checkout_abandonment"
    CHRONIC_FAILURE = "chronic_failure"
    FRAUD_SUSPECTED = "fraud_suspected"
    UNKNOWN = "unknown"


class Action(str, Enum):
    """Candidate recovery actions — mirrors schemas/diagnosis.schema.json #/$defs/action."""

    RETRY = "retry"
    DELAYED_RETRY = "delayed_retry"
    ALT_METHOD = "alt_method"
    PAYMENT_LINK = "payment_link"
    NOTIFY = "notify"
    ESCALATE = "escalate"
    NO_ACTION = "no_action"


class DiagnoseRequest(BaseModel):
    """The service-to-service request body for POST /internal/diagnose.

    It is the minimal, MONEYLESS slice of a failed-payment event the classifier reasons over
    — deliberately no amount and no merchant economics reach the intelligence plane. It mirrors
    the Go ``diagnosis.Input`` struct, plus an optional ``payment_event_id`` for log correlation.
    """

    model_config = ConfigDict(extra="forbid")

    event_type: str = Field(min_length=1)
    failure_reason: str = ""
    method: str = ""
    prior_attempts: int = Field(default=0, ge=0)
    payment_event_id: str | None = None


class DiagnosisCore(BaseModel):
    """The four fields the LLM itself produces, validated against the frozen contract.

    The service supplies ``schema_version``, ``model_version`` and ``source`` around this — the
    model is never trusted to stamp its own provenance. A malformed tool call (bad enum, empty
    rationale, no candidate actions, out-of-range confidence) raises ``ValidationError`` here,
    which the endpoint maps to a structured non-2xx so the Go caller falls back to the rule
    table (PLAN.md §12: "malformed/missing fields → fallback path, never a crash").
    """

    model_config = ConfigDict(extra="forbid")

    root_cause: RootCause
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(min_length=1)
    candidate_actions: list[Action] = Field(min_length=1)


class Diagnosis(BaseModel):
    """The full, schema-valid diagnosis returned to the decision plane.

    Field set and constraints mirror schemas/diagnosis.schema.json exactly (additionalProperties
    false → ``extra="forbid"``).
    """

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["0.1.0"] = SCHEMA_VERSION
    root_cause: RootCause
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(min_length=1)
    candidate_actions: list[Action] = Field(min_length=1)
    model_version: str = Field(min_length=1)
    source: Literal["llm", "rule_based_fallback"] = "llm"
    payment_event_id: str | None = None
    created_at: str | None = None


# Anthropic "tool" definition. Forcing a tool call (tool_choice) is how we constrain the model
# to emit exactly this JSON shape instead of prose — the structured/JSON-schema-constrained
# output PLAN.md §14 calls for. Only the four model-produced fields are in the schema; the
# service stamps schema_version/model_version/source itself.
TOOL_NAME = "emit_diagnosis"


def diagnosis_tool() -> dict[str, Any]:
    """Build the Anthropic tool spec whose input_schema is the diagnosis contract subset."""
    return {
        "name": TOOL_NAME,
        "description": (
            "Emit the structured root-cause diagnosis for a failed payment. Call this exactly "
            "once. Do not compute any probability of recovery and do not choose the final "
            "action — only classify the cause and list plausible candidate actions."
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["root_cause", "confidence", "rationale", "candidate_actions"],
            "properties": {
                "root_cause": {
                    "type": "string",
                    "enum": [c.value for c in RootCause],
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": (
                        "How certain the classification is. GATING signal only — never a "
                        "probability of payment recovery."
                    ),
                },
                "rationale": {"type": "string", "minLength": 1},
                "candidate_actions": {
                    "type": "array",
                    "minItems": 1,
                    "items": {"type": "string", "enum": [a.value for a in Action]},
                },
            },
        },
    }
