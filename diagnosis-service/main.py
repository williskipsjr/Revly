"""Diagnosis Service (Intelligence plane).

Phase 0: FastAPI app exposing /health and /version so the service boots and health-checks.
Phase 4: adds POST /internal/diagnose — an LLM classifier that turns a failed-payment event
into a schema-validated Diagnosis (root cause, confidence, rationale, candidate actions) using
JSON-schema-constrained (tool-forced) output through the AgentRouter gateway.

This service is deliberately ISOLATED. It holds NO payment credentials and receives only the
LLM API key. It never computes P(success), never calls the payment API, never selects the
executed action, and never decides an amount (PLAN.md §7).

Fallback ownership: this service does NOT reimplement the Phase-2 rule table. On any internal
failure (no credential, transport error, timeout, or malformed/invalid model output) it returns
a structured non-2xx, and the Go decision plane — the single source of truth for the rule table —
falls back deterministically. Killing this service therefore yields automatic, correct
rule-based diagnosis with no pipeline stall (PLAN.md §15 "Done when").
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Callable

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from llm_client import AgentRouterClient, LLMError, is_configured
from schema import Diagnosis, DiagnoseRequest, DiagnosisCore, SCHEMA_VERSION, diagnosis_tool

SERVICE_NAME = "diagnosis-service"
SERVICE_VERSION = "0.1.0"

# A completion callable: (system_prompt, user_prompt, tool_spec) -> tool_input_dict.
# Injecting this is what lets the classifier core be tested without the anthropic SDK.
Completion = Callable[[str, str, dict], dict]

app = FastAPI(title="Diagnosis Service", version=SERVICE_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME, "version": SERVICE_VERSION}


@app.get("/version")
def version() -> dict[str, object]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "llm_model": os.getenv("LLM_MODEL", "unset"),
        "llm_configured": is_configured(),
    }


@app.post("/internal/diagnose")
def diagnose(req: DiagnoseRequest) -> object:
    """Classify a failed payment. Internal, service-to-service only (PLAN.md §9, never public).

    Returns a schema-valid Diagnosis (200) or a structured error (non-2xx) that tells the Go
    caller to fall back to the deterministic rule table. It never raises into an unhandled 500.
    """
    if not is_configured():
        return JSONResponse(
            status_code=503,
            content={"error": "llm_unavailable", "detail": "no LLM credential configured"},
        )

    try:
        client = _client()
        diagnosis = run_diagnosis(req, client.complete, client.model)
    except LLMError as exc:
        return JSONResponse(status_code=502, content={"error": "llm_failed", "detail": str(exc)})
    except ValidationError as exc:
        # The model returned output that violates the diagnosis contract.
        return JSONResponse(
            status_code=502,
            content={"error": "invalid_diagnosis", "detail": exc.errors(include_url=False)},
        )
    except Exception as exc:  # noqa: BLE001 - never crash; any surprise → fallback path
        return JSONResponse(status_code=502, content={"error": "internal_error", "detail": str(exc)})

    return JSONResponse(status_code=200, content=diagnosis.model_dump())


def run_diagnosis(req: DiagnoseRequest, complete: Completion, model_version: str) -> Diagnosis:
    """Pure classifier core: prompt → forced tool call → validated Diagnosis.

    Raises LLMError (transport/no-tool) or pydantic ValidationError (malformed tool output).
    The service stamps schema_version, model_version and source="llm"; the model is never
    trusted to assert its own provenance.
    """
    system = _load_prompt()
    user = _render_event(req)
    raw = complete(system, user, diagnosis_tool())

    core = DiagnosisCore.model_validate(raw)  # raises ValidationError on any contract violation
    return Diagnosis(
        schema_version=SCHEMA_VERSION,
        root_cause=core.root_cause,
        confidence=core.confidence,
        rationale=core.rationale,
        candidate_actions=core.candidate_actions,
        model_version=model_version,
        source="llm",
        payment_event_id=req.payment_event_id,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def _render_event(req: DiagnoseRequest) -> str:
    """Compact, deterministic rendering of the moneyless event fields for the model."""
    return (
        "Classify this failed payment.\n"
        f"event_type: {req.event_type}\n"
        f"failure_reason: {req.failure_reason or '(none provided)'}\n"
        f"payment_method: {req.method or '(unknown)'}\n"
        f"prior_attempts: {req.prior_attempts}\n"
    )


@lru_cache(maxsize=1)
def _load_prompt() -> str:
    path = Path(__file__).parent / "prompts" / "diagnose.txt"
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _client() -> AgentRouterClient:
    """Build the gateway client once. Raises LLMError if the SDK/credential is unavailable."""
    return AgentRouterClient()
