def score_ticket_stub(ticket):
    """Lightweight Python stub for CTQ scoring used in tests.

    Returns a predictable structure similar to the real engine.
    """
    # Simple heuristic: presence of 'resolved' or 'reboot' increases score
    text = ' '.join([str(ticket.get(k, '')) for k in ('short_description', 'work_notes', 'description')]).lower()
    score = 50
    if 'resolved' in text or 'reboot' in text or 'fixed' in text:
        score += 30
    if 'error' in text or 'fail' in text:
        score -= 20
    score = max(0, min(100, score))
    return {
        'overall_score': float(score),
        'grade': 'Good' if score >= 70 else 'Fair' if score >= 50 else 'Poor',
        'ctq_scores': {},
    }
