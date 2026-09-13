# SPDX-FileCopyrightText: 2026 wahl.chat
#
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""
Bulk-runner unit tests (pure helpers only; the store/API plumbing is exercised
via the stub demo run).

Tests defined here:
  - test_last_activity_orders_never_touched_first: no activity → epoch, so new
    pledges outrank previously attempted ones in the batch ordering.
  - test_last_activity_counts_failed_attempts: pledgetracker_last_attempted_at
    advances the ordering key, so a recently failed pledge yields its batch
    slot to pledges with older activity.
  - test_stale_pledge_ids_flags_only_missing: reconcile deletes exactly the
    store ids absent from the registry.
"""

from __future__ import annotations

from src.ingestion.connectors.pledgetracker.bulk import (
    _last_activity,
    _stale_pledge_ids,
)


def test_last_activity_orders_never_touched_first() -> None:
    """A pledge with no recorded activity sorts before any touched pledge."""
    untouched = _last_activity({})
    checked = _last_activity({"last_checked_at": "2026-01-01T00:00:00+00:00"})
    assert untouched < checked


def test_last_activity_counts_failed_attempts() -> None:
    """The ordering key is the max of successful check and failed attempt."""
    failed_recently = _last_activity(
        {
            "last_checked_at": "2026-01-01T00:00:00+00:00",
            "pledgetracker_last_attempted_at": "2026-02-01T00:00:00+00:00",
        }
    )
    checked_later = _last_activity({"last_checked_at": "2026-01-15T00:00:00+00:00"})
    assert failed_recently > checked_later


def test_stale_pledge_ids_flags_only_missing() -> None:
    """Ids in the stores but not in the registry are stale; the rest are kept."""
    assert _stale_pledge_ids({"a", "b"}, ["a", "b", "c"]) == {"c"}
    assert _stale_pledge_ids({"a"}, []) == set()
