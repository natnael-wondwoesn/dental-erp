from concurrent.futures import ThreadPoolExecutor

import pytest

from app.licensing.activation_issuer import (
    InMemoryActivationReplayStore,
    accept_activation_request,
)
from tests.test_activation_request import request


def test_request_is_consumed_exactly_once() -> None:
    store = InMemoryActivationReplayStore()
    payload = accept_activation_request(
        request(), expected_product_id="dental-erp", replay_store=store
    )
    assert payload.product_id == "dental-erp"
    with pytest.raises(ValueError, match="already been used"):
        accept_activation_request(request(), expected_product_id="dental-erp", replay_store=store)


def test_wrong_product_does_not_consume_request() -> None:
    store = InMemoryActivationReplayStore()
    with pytest.raises(ValueError, match="another product"):
        accept_activation_request(request(), expected_product_id="clinic-cms", replay_store=store)
    assert (
        accept_activation_request(
            request(), expected_product_id="dental-erp", replay_store=store
        ).product_id
        == "dental-erp"
    )


def test_concurrent_replay_has_exactly_one_winner() -> None:
    store = InMemoryActivationReplayStore()

    def attempt() -> bool:
        try:
            accept_activation_request(
                request(), expected_product_id="dental-erp", replay_store=store
            )
            return True
        except ValueError:
            return False

    with ThreadPoolExecutor(max_workers=16) as executor:
        outcomes = list(executor.map(lambda _: attempt(), range(64)))
    assert outcomes.count(True) == 1
    assert outcomes.count(False) == 63
