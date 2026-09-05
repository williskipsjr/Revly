"""Thin AgentRouter (Anthropic-compatible) client for the diagnosis classifier.

The ``anthropic`` SDK is imported LAZILY, inside the constructor — so importing this module (and
therefore ``main`` and the tests) works in environments where the package is not installed (the
offline sandbox). Production installs it via requirements.txt.

Gateway wiring follows what is already established in the repo plus AgentRouter's own docs:
  - ANTHROPIC_BASE_URL  → the gateway origin, WITHOUT a "/v1" suffix (default https://agentrouter.org).
                          The SDK appends the Messages path itself.
  - ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY → the AgentRouter key. AgentRouter authenticates
                          with a Bearer token, so the value is passed as the SDK's ``auth_token``
                          (Authorization: Bearer …), not ``api_key`` (x-api-key).
  - LLM_MODEL           → the model id (default claude-sonnet-5).

The client's single job is to force the ``emit_diagnosis`` tool and return its raw input dict.
Any failure — missing dep, transport error, timeout, or a response with no tool call — is raised
as ``LLMError`` so the endpoint returns a structured non-2xx and the Go caller falls back to the
rule table. This service NEVER reimplements that rule table (single source of truth = Go).
"""
from __future__ import annotations

import os
from typing import Any

DEFAULT_BASE_URL = "https://agentrouter.org"
DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_MAX_TOKENS = 1024
DEFAULT_TIMEOUT_SECONDS = 8.0


class LLMError(Exception):
    """Any failure reaching or parsing the LLM gateway. Signals the fallback path."""


def _token() -> str | None:
    # AGENTROUTER uses Bearer auth (ANTHROPIC_AUTH_TOKEN); fall back to the repo's established
    # ANTHROPIC_API_KEY name so either works. Empty/unset → not configured.
    tok = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    return tok or None


def is_configured() -> bool:
    """True when a credential is present; the endpoint 503s (→ fallback) when it is not."""
    return _token() is not None


class AgentRouterClient:
    """Forces the diagnosis tool call through an Anthropic-compatible gateway."""

    def __init__(self) -> None:
        token = _token()
        if token is None:
            raise LLMError("no LLM credential configured (ANTHROPIC_AUTH_TOKEN/ANTHROPIC_API_KEY)")

        self.model = os.getenv("LLM_MODEL", DEFAULT_MODEL)
        self.max_tokens = _int_env("LLM_MAX_TOKENS", DEFAULT_MAX_TOKENS)
        self.timeout = _float_env("LLM_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)
        base_url = os.getenv("ANTHROPIC_BASE_URL", DEFAULT_BASE_URL)

        try:
            import anthropic  # lazy: absent in the offline sandbox, present in production
        except ImportError as exc:  # pragma: no cover - exercised only without the dep
            raise LLMError(f"anthropic SDK not installed: {exc}") from exc

        # auth_token → Authorization: Bearer (AgentRouter's scheme), not x-api-key.
        self._client = anthropic.Anthropic(
            base_url=base_url,
            auth_token=token,
            timeout=self.timeout,
        )

    def complete(self, system: str, user: str, tool: dict[str, Any]) -> dict[str, Any]:
        """Call the model with a forced tool choice and return the tool's input dict.

        Raises LLMError on transport failure, timeout, or a response that contains no
        tool_use block for the requested tool.
        """
        try:
            resp = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
            )
        except Exception as exc:  # noqa: BLE001 - all provider/transport errors → fallback
            raise LLMError(f"llm request failed: {exc}") from exc

        for block in getattr(resp, "content", []) or []:
            if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == tool["name"]:
                raw = getattr(block, "input", None)
                if isinstance(raw, dict):
                    return raw
                raise LLMError("tool_use block had non-object input")
        raise LLMError("no emit_diagnosis tool_use block in model response")


def _int_env(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, "") or default)
    except ValueError:
        return default


def _float_env(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, "") or default)
    except ValueError:
        return default
