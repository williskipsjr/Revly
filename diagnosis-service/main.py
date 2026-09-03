"""Diagnosis Service (Intelligence plane).

Phase 0: FastAPI app exposing /health and /version so the service boots and health-checks.

This service is deliberately ISOLATED. It holds NO payment credentials and (from Phase 4)
receives only the LLM API key. Its single responsibility is to turn an event + context into a
schema-validated Diagnosis (root cause, confidence, rationale, candidate actions). It never
computes P(success), never calls the payment API, and never decides an amount.

Phase 4 adds: POST /internal/diagnose (LLM classifier, JSON-schema-constrained output,
fallback to the Phase-2 rule table on timeout/invalid schema).
"""
from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "diagnosis-service"
SERVICE_VERSION = "0.1.0"

app = FastAPI(title="Diagnosis Service", version=SERVICE_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME, "version": SERVICE_VERSION}


@app.get("/version")
def version() -> dict[str, str]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "llm_model": os.getenv("LLM_MODEL", "unset"),
    }
