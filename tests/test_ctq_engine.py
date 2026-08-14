import pytest

from ctq_engine_stub import score_ticket_stub


def test_score_ticket_stub():
    # Minimal smoke test for scoring engine stub
    ticket = {'short_description': 'Test ticket', 'work_notes': 'Resolved by reboot'}
    result = score_ticket_stub(ticket)
    assert 'overall_score' in result
    assert 0 <= result['overall_score'] <= 100
