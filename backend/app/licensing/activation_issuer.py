"""Issuer-side acceptance rules for self-signed activation requests."""

from __future__ import annotations

import threading
from typing import Protocol

from app.licensing.activation import ActivationRequestPayload, verify_activation_request


class ActivationReplayStore(Protocol):
    """Atomically consume a request ID and nonce exactly once."""

    def consume(self, request_id: str, nonce: str) -> bool: ...


class InMemoryActivationReplayStore:
    """Thread-safe adapter for tests and local issuer development only."""

    def __init__(self) -> None:
        self._request_ids: set[str] = set()
        self._nonces: set[str] = set()
        self._lock = threading.Lock()

    def consume(self, request_id: str, nonce: str) -> bool:
        with self._lock:
            if request_id in self._request_ids or nonce in self._nonces:
                return False
            self._request_ids.add(request_id)
            self._nonces.add(nonce)
            return True


def accept_activation_request(
    raw_request: str,
    *,
    expected_product_id: str,
    replay_store: ActivationReplayStore,
) -> ActivationRequestPayload:
    payload = verify_activation_request(raw_request)
    if payload.product_id != expected_product_id:
        raise ValueError("Activation request belongs to another product")
    if not replay_store.consume(payload.request_id, payload.nonce):
        raise ValueError("Activation request has already been used")
    return payload
