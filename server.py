"""
YK CTQ Audit Intelligence Platform — Flask Backend v4.0
========================================================
New in v4.0:
  - 7-dimension SentimentEngine (frustration, urgency, VIP, SLA anxiety, etc.)
  - ResolutionIntegrityEngine (code-vs-notes Jaccard mismatch detector)
  - CategoryQualityEngine (TF-IDF cosine confidence + mis-categorisation flags)
  - NotePatternEngine (per-ticket coaching suggestions from pattern library)
  - /api/history/* family (weekly trends, agent summaries, anomaly flags)
  - /api/analyse/sentiment — ad-hoc 7-dim analysis
  - /api/patterns/notes — CRUD for note pattern library
  - /api/automation/candidates — async K-means cluster results
  - /api/repeat/callers — 30-day repeat caller list
  - FCR detection and repeat-caller flagging at batch time
  - Async K-means automation candidate clustering

Run:
    python server.py
    # or, for production:
    waitress-serve --host 127.0.0.1 --port 8745 server:app

Opens at: http://localhost:8745
"""
from __future__ import annotations

import bcrypt
import json
import logging
import math
import os
import re
import secrets
import sqlite3
import threading
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS

try:
    from flask_mail import Mail, Message
    _MAIL_AVAILABLE = True
except ImportError:
    _MAIL_AVAILABLE = False

try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    _LIMITER_AVAILABLE = True
except ImportError:
    _LIMITER_AVAILABLE = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    import numpy as np
    _SKLEARN = True
except ImportError:
    _SKLEARN = False

# Load environment variables from .env file
load_dotenv()

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "data" / "ctq_history.db"
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__, static_folder=str(BASE_DIR))

# Security configuration
# NOTE: SECRET_KEY is set further down (after logging is configured), via
# _get_or_create_secret_key() — see that function for why.
app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true'  # False for HTTP dev
app.config['SESSION_COOKIE_HTTPONLY'] = True  # No JS access to session
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF protection
app.config['PERMANENT_SESSION_LIFETIME'] = int(os.getenv('PERMANENT_SESSION_LIFETIME', 28800))  # 8 hours
app.config['SESSION_COOKIE_NAME'] = 'ctq_session'

# CORS configuration — restrict to specified origins for security
cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8745').split(',')
cors_origins = [o.strip() for o in cors_origins]
CORS(app, origins=cors_origins, supports_credentials=True)

# Email configuration (optional)
app.config['MAIL_ENABLED'] = os.getenv('MAIL_ENABLED', 'false').lower() == 'true'
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@ctq-enterprise.local')

mail = Mail(app) if _MAIL_AVAILABLE else None

# ---------------------------------------------------------------------------
# Logging — console + daily rotating file in Logs/
# ---------------------------------------------------------------------------
LOG_DIR = BASE_DIR / "Logs"
LOG_DIR.mkdir(exist_ok=True)

from logging.handlers import TimedRotatingFileHandler

_log_fmt = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Console handler
_console_h = logging.StreamHandler()
_console_h.setFormatter(_log_fmt)
_console_h.setLevel(logging.INFO)

# Daily rotating file: Logs/ctq-YYYY-MM-DD.log
_file_h = TimedRotatingFileHandler(
    filename=str(LOG_DIR / "ctq.log"),
    when="midnight",
    interval=1,
    backupCount=30,        # keep 30 days of logs
    encoding="utf-8",
    utc=False
)
_file_h.suffix = "%Y-%m-%d"
_file_h.setFormatter(_log_fmt)
_file_h.setLevel(logging.DEBUG)

# Root logger — DEBUG to file, INFO to console
_root = logging.getLogger()
_root.setLevel(logging.DEBUG)
_root.addHandler(_console_h)
_root.addHandler(_file_h)

# Flask/Werkzeug stays at INFO
logging.getLogger("werkzeug").setLevel(logging.INFO)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SECRET_KEY — must be stable across restarts, or every active session
# (every logged-in user) is silently invalidated each time the process
# restarts/redeploys. Precedence: explicit SECRET_KEY env var (production
# default), then a key persisted to .secret_key next to server.py
# (generated once, reused after that), and only as a last resort a fresh
# random key for this process if the file can't be written.
# ---------------------------------------------------------------------------
def _get_or_create_secret_key() -> str:
    env_key = os.getenv('SECRET_KEY')
    if env_key:
        return env_key

    key_path = BASE_DIR / ".secret_key"
    try:
        if key_path.exists():
            key = key_path.read_text(encoding="utf-8").strip()
            if key:
                return key
        key = secrets.token_hex(32)
        key_path.write_text(key, encoding="utf-8")
        try:
            os.chmod(key_path, 0o600)  # best-effort; no-op on platforms without POSIX perms (e.g. Windows)
        except OSError:
            pass
        log.info("Generated and persisted a new SECRET_KEY to %s", key_path)
        return key
    except OSError as e:
        log.warning("Could not read/write .secret_key (%s); sessions will not survive a restart. "
                     "Set SECRET_KEY in the environment to fix this.", e)
        return secrets.token_hex(32)


app.config['SECRET_KEY'] = _get_or_create_secret_key()

# ---------------------------------------------------------------------------
# Rate limiting — protects /api/auth/login from brute-force credential
# guessing. Uses in-memory storage, which is correct for this app's single
# -process deployment model (app.run(threaded=True) / one waitress worker);
# if this is ever run behind multiple worker processes, point storage_uri at
# a shared backend (e.g. Redis) or per-process limits stop being enforced
# globally.
# ---------------------------------------------------------------------------
if _LIMITER_AVAILABLE:
    limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")
else:
    limiter = None
    log.warning("flask-limiter not installed; /api/auth/login is not rate-limited")


def _rate_limited(limit_str):
    """Decorator factory: applies a flask-limiter limit when the library is
    installed, and is a harmless no-op otherwise (same optional-dependency
    pattern as flask_mail/sklearn above)."""
    def decorator(f):
        if limiter is None:
            return f
        return limiter.limit(limit_str)(f)
    return decorator


APP_VERSION = "4.0.0"

# Shared state for async K-means
_cluster_lock  = threading.Lock()
_cluster_state = {"status": "idle", "updated_at": None, "results": []}

# ---------------------------------------------------------------------------
# Users — bcrypt password hashing for production security
# ---------------------------------------------------------------------------
# Set to True by _load_users_from_env() if it seeded the dev-default admin
# account. Checked at startup to refuse binding to a non-loopback host while
# a known, publicly-documented default credential is active. See the guard
# in `if __name__ == "__main__":` below.
_DEV_DEFAULTS_ACTIVE = False


def _load_users_from_env() -> dict:
    """Load users from environment variables with bcrypt hashes.

    Default users for development (change in production):
    - admin / Admin@CTQ2025
    - user / user123

    To generate bcrypt hash:
        python -c "import bcrypt; print(bcrypt.hashpw(b'password', bcrypt.gensalt(12)).decode())"
    """
    global _DEV_DEFAULTS_ACTIVE

    # In production require explicit bcrypt hashes set in environment for accounts.
    # Optionally allow a development-only seeded default when ALLOW_DEV_DEFAULTS=true
    env_admin_hash = os.getenv('ADMIN_PASSWORD_HASH')
    env_user_hash = os.getenv('USER_PASSWORD_HASH')

    users = {}

    # Admin user: include only if a hash is provided or dev defaults are explicitly allowed
    if env_admin_hash:
        users["admin"] = {
            "password_hash": env_admin_hash,
            "role": "admin",
            "displayName": "System Administrator",
        }
    else:
        # Development convenience: seed default bcrypt hash only when explicitly enabled
        allow_dev = os.getenv('ALLOW_DEV_DEFAULTS', 'false').lower() == 'true'
        is_dev = os.getenv('FLASK_ENV', '').lower() == 'development'
        if is_dev and allow_dev:
            # Default dev bcrypt hash for Admin@CTQ2025 (cost=12)
            users["admin"] = {
                "password_hash": "$2b$12$7VCT1w6Xyd1igT6Z/5qXsuTwGSqEholqVM.J2YUd0sYOwt7ddrZgy",
                "role": "admin",
                "displayName": "System Administrator (dev)",
            }
            _DEV_DEFAULTS_ACTIVE = True
        else:
            log.warning('No ADMIN_PASSWORD_HASH provided; admin login disabled until configured')

    if env_user_hash:
        users["user"] = {
            "password_hash": env_user_hash,
            "role": "user",
            "displayName": "Standard User",
        }
    return users


USERS = _load_users_from_env()


def _verify_password(stored_hash: str, provided_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(provided_password.encode(), stored_hash.encode())
    except Exception as e:
        log.warning("Password verification error: %s", e)
        return False

# ---------------------------------------------------------------------------
# SQLite persistence
# ---------------------------------------------------------------------------
@contextmanager
def _db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def _init_db() -> None:
    """Create tables and safely migrate schema if upgrading from v3."""
    with _db() as con:
        # Core tables (v3)
        con.executescript("""
            CREATE TABLE IF NOT EXISTS audit_batches (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at  TEXT    NOT NULL,
                username    TEXT,
                ticket_type TEXT,
                row_count   INTEGER,
                avg_score   REAL,
                pass_rate   REAL
            );
            CREATE TABLE IF NOT EXISTS audit_tickets (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id        INTEGER REFERENCES audit_batches(id),
                ticket_number   TEXT,
                overall_score   REAL,
                grade           TEXT,
                compliance_pass INTEGER,
                sentiment       TEXT,
                pillar_scores   TEXT,
                ctq_scores      TEXT,
                coaching_notes  TEXT,
                audited_at      TEXT,
                caller          TEXT,
                category        TEXT,
                resolution_code TEXT,
                assigned_to     TEXT
            );
        """)

        # v3.0→v4.0 safe column migrations — safe to re-run, ADD COLUMN is idempotent
        # v3.0 columns that may be missing on older databases
        _add_column(con, "audit_tickets", "caller",                "TEXT")
        _add_column(con, "audit_tickets", "category",              "TEXT")
        _add_column(con, "audit_tickets", "resolution_code",       "TEXT")
        _add_column(con, "audit_tickets", "assigned_to",           "TEXT")
        # v4.0 new columns
        _add_column(con, "audit_tickets", "sentiment_profile",     "TEXT")
        _add_column(con, "audit_tickets", "category_confidence",   "REAL")
        _add_column(con, "audit_tickets", "category_flag",         "INTEGER DEFAULT 0")
        _add_column(con, "audit_tickets", "category_suggestion",   "TEXT")
        _add_column(con, "audit_tickets", "resolution_integrity",  "REAL")
        _add_column(con, "audit_tickets", "fcr_fail",              "INTEGER DEFAULT 0")
        _add_column(con, "audit_tickets", "note_suggestions",      "TEXT")

        # v4.0 new tables
        con.executescript("""
            CREATE TABLE IF NOT EXISTS note_patterns (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                category        TEXT    NOT NULL,
                criterion_id    INTEGER NOT NULL,
                criterion_name  TEXT    NOT NULL,
                weak_signal     TEXT,
                prompt          TEXT    NOT NULL,
                strong_example  TEXT,
                created_at      TEXT,
                updated_at      TEXT
            );

            CREATE TABLE IF NOT EXISTS kb_citations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id    INTEGER REFERENCES audit_batches(id),
                ticket_id   INTEGER REFERENCES audit_tickets(id),
                kb_article  TEXT    NOT NULL,
                category    TEXT,
                audited_at  TEXT
            );

            CREATE TABLE IF NOT EXISTS repeat_callers (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                caller          TEXT    NOT NULL,
                window_start    TEXT    NOT NULL,
                window_end      TEXT    NOT NULL,
                ticket_count    INTEGER NOT NULL,
                categories      TEXT,
                computed_at     TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_summaries (
                week_start      TEXT    NOT NULL,
                agent_name      TEXT    NOT NULL,
                ticket_count    INTEGER,
                avg_score       REAL,
                worst_criterion TEXT,
                fcr_rate        REAL,
                PRIMARY KEY (week_start, agent_name)
            );

            CREATE TABLE IF NOT EXISTS anomaly_flags (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                week_start  TEXT,
                metric      TEXT,
                direction   TEXT,
                value       REAL,
                baseline    REAL,
                sigma_delta REAL,
                created_at  TEXT
            );

            CREATE TABLE IF NOT EXISTS automation_clusters (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                cluster_id      INTEGER,
                label           TEXT,
                ticket_count    INTEGER,
                sample_tickets  TEXT,
                top_terms       TEXT,
                automation_type TEXT,
                computed_at     TEXT
            );
        """)

    # Seed note pattern library if empty
    _seed_note_patterns()


def _add_column(con, table: str, column: str, col_type: str) -> None:
    """Add a column to a table if it does not already exist."""
    try:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
    except sqlite3.OperationalError:
        pass  # Column already exists


# ---------------------------------------------------------------------------
# Intelligence Engine 1 — 7-Dimension Sentiment
# ---------------------------------------------------------------------------
class SentimentEngine:
    """Analyses text across seven dimensions. All scores 0–100."""

    NEGATION = ["not","never","still","no","cannot","won't","can't","don't",
                "didn't","isn't","wasn't","hasn't","couldn't","shouldn't"]

    URGENCY_KW = ["urgent","critical","asap","immediately","emergency","cannot wait",
                  "breach","escalate","manager","unacceptable","still not fixed",
                  "hours ago","days ago","waiting all day","not good enough","livid"]

    VIP_MARKERS = ["vip","executive","director","ceo","cto","coo","cfo","vp ",
                   "vice president","board","c-suite","head of","chief ","president"]

    SLA_PATTERNS = ["breach","overdue","sla","xla","deadline","due date",
                    "still waiting","hours left","due in","target","past due"]

    HEDGE_WORDS = ["should be","might","hopefully","probably","may work","could",
                   "perhaps","unclear","unsure","not sure","might resolve"]

    CERTAINTY_WORDS = ["resolved","confirmed","verified","tested","fixed",
                       "working","completed","done","successful","restored"]

    CONFIRMATION_P = ["user confirmed","caller confirmed","confirmed working",
                      "tested and working","verified by user","working as expected",
                      "confirmed by","signed off","positive confirmation"]

    POS_WORDS = ["resolved","fixed","completed","success","assisted","happy","glad",
                 "great","thank","working","done","sorted","pleasure","kind","prompt",
                 "excellent","outstanding","apologise","appreciate","pleased"]

    NEG_WORDS = ["frustrated","escalated","unacceptable","still not","not working",
                 "issue persists","not resolved","delay","overdue","waiting","breach",
                 "unhappy","disappointed","urgent","complaint","broken","fail",
                 "error","cannot","unable","ignored","unresolved"]

    @classmethod
    def analyse(cls, text: str, caller: str = "", priority: str = "",
                caller_history_count: int = 0) -> dict:
        t    = text.lower()
        raw  = text
        words = t.split()
        wc   = max(len(words), 1)

        # 1. Polarity
        pos_hits = sum(t.count(w) for w in cls.POS_WORDS)
        neg_hits = sum(t.count(w) for w in cls.NEG_WORDS)
        total    = pos_hits + neg_hits + 1
        polarity = round(min(100, max(0, ((pos_hits / total) * 70) + 15)))

        # 2. Frustration index
        alpha     = max(sum(1 for c in raw if c.isalpha()), 1)
        caps      = sum(1 for c in raw if c.isupper() and c.isalpha())
        caps_ratio = caps / alpha
        neg_density = sum(t.count(w) for w in cls.NEGATION) / wc
        tgrams      = [" ".join(words[i:i+3]) for i in range(len(words) - 2)]
        repeat_pg   = sum(1 for c in Counter(tgrams).values() if c >= 2)
        punct       = raw.count("!") + raw.count("?") + raw.count("...")
        sents       = max(len(re.split(r"[.!?]+", raw)), 1)
        punc_score  = punct / sents
        frustration = round(min(100, max(0,
            caps_ratio * 30 +
            min(neg_density * wc, 5) / 5 * 30 +
            min(repeat_pg, 5) / 5 * 20 +
            min(punc_score, 1.0) * 20
        )))

        # 3. Escalation urgency
        urg_hits = sum(1 for kw in cls.URGENCY_KW if kw in t)
        pri_low  = bool(re.search(r"\b(low|p4|p5)\b", priority.lower()))
        urg_score = min(100, urg_hits * 18 + (20 if (urg_hits > 0 and pri_low) else 0))

        # 4. VIP sensitivity
        combined = (caller + " " + text).lower()
        vip_hit  = any(v in combined for v in cls.VIP_MARKERS)
        vip_score = 90 if vip_hit else 10

        # 5. SLA anxiety
        sla_hits  = sum(1 for p in cls.SLA_PATTERNS if p in t)
        sla_score = min(100, sla_hits * 20)

        # 6. Resolution confidence
        hedge_hits    = sum(1 for w in cls.HEDGE_WORDS if w in t)
        certain_hits  = sum(1 for w in cls.CERTAINTY_WORDS if w in t)
        total_rc      = certain_hits + hedge_hits
        if total_rc == 0:
            res_conf = 50
        else:
            res_conf = round(min(100, (certain_hits / total_rc) * 100))

        # 7. Repeat caller signal
        repeat_signal = min(100, caller_history_count * 25)

        # Legacy type for backwards compat
        if neg_hits > pos_hits + 1:
            s_type = "Negative"
        elif pos_hits > neg_hits + 1:
            s_type = "Positive"
        else:
            s_type = "Neutral"

        reasons = []
        if frustration > 70:
            reasons.append("High frustration detected")
        if urg_score > 80:
            reasons.append("Escalation urgency indicators present")
        if vip_score > 50:
            reasons.append("VIP caller markers found")
        reason = "; ".join(reasons) if reasons else f"{s_type} tone"

        return {
            "polarity":             polarity,
            "frustration_index":    frustration,
            "escalation_urgency":   urg_score,
            "vip_sensitivity":      vip_score,
            "sla_anxiety":          sla_score,
            "resolution_confidence": res_conf,
            "repeat_caller_signal": repeat_signal,
            "sentiment_type":       s_type,
            "sentiment_reason":     reason,
        }


# ---------------------------------------------------------------------------
# Intelligence Engine 2 — Resolution Integrity
# ---------------------------------------------------------------------------
class ResolutionIntegrityEngine:
    """Checks alignment between resolution code and resolution notes."""

    CODE_TERMS: dict[str, list[str]] = {
        "resolved by it":      ["fix","resolved","corrected","repaired","restored","tested","confirmed"],
        "resolved by caller":  ["user","caller","self","themselves","independently"],
        "user education":      ["explained","trained","showed","guided","educated","documented"],
        "workaround provided": ["workaround","temporary","interim","alternative"],
        "no fault found":      ["tested","checked","verified","no issue","unable to reproduce"],
        "third party":         ["vendor","supplier","third party","escalated","external"],
        "duplicate":           ["duplicate","existing","same","already logged"],
    }

    CONFIRMATION = [
        "user confirmed","caller confirmed","confirmed working","tested and working",
        "verified by user","working as expected","confirmed by","signed off",
        "positive confirmation","successful test",
    ]

    ACTION_VERBS = [
        "restart","reboot","reset","reinstall","update","patch","clear","reconfigure",
        "tested","verified","confirmed","applied","fixed","resolved","removed",
        "installed","replaced","migrated","rebuilt","granted","revoked",
    ]

    @classmethod
    def score(cls, resolution_notes: str, resolution_code: str, state: str) -> dict:
        rn    = resolution_notes.lower().strip()
        rc    = resolution_code.lower().strip()
        rn_wds = set(re.findall(r"\b\w+\b", rn))

        # Identify code-implied terms
        code_terms: list[str] = []
        for pattern, terms in cls.CODE_TERMS.items():
            if any(w in rc for w in pattern.split()):
                code_terms = terms
                break
        if not code_terms:
            code_terms = ["resolved", "fix", "tested", "confirmed"]

        code_set = set(code_terms)
        union = rn_wds | code_set
        inter = rn_wds & code_set
        jaccard = len(inter) / len(union) if union else 0.0

        # Completeness
        word_count = len(rn.split())
        action_hits = sum(1 for v in cls.ACTION_VERBS if v in rn)
        completeness = min(1.0, (min(word_count, 20) / 20) * 0.6 + (min(action_hits, 3) / 3) * 0.4)

        # Verification
        verification = 1 if any(p in rn for p in cls.CONFIRMATION) else 0

        integrity = round(jaccard * 40 + completeness * 35 + verification * 25, 1)

        return {
            "resolution_integrity":     integrity,
            "ri_jaccard":               round(jaccard, 3),
            "ri_completeness":          round(completeness, 3),
            "ri_verification":          verification,
        }


# ---------------------------------------------------------------------------
# Intelligence Engine 3 — Category Quality (keyword cosine)
# ---------------------------------------------------------------------------
class CategoryQualityEngine:
    """Detects likely mis-categorisation using keyword overlap scoring."""

    _kw_map: dict = {}
    _loaded: bool = False

    @classmethod
    def _load(cls) -> dict:
        if cls._loaded:
            return cls._kw_map
        path = DATA_DIR / "category_keywords_default.json"
        try:
            with open(path, encoding="utf-8") as f:
                cls._kw_map = json.load(f)
        except Exception:
            cls._kw_map = {}
        cls._loaded = True
        return cls._kw_map

    @classmethod
    def score(cls, text: str, assigned_category: str) -> dict:
        kw_map = cls._load()
        if not kw_map or not assigned_category:
            return {"category_confidence": None, "category_flag": False,
                    "category_suggestion": None, "category_flag_reason": None}

        text_words = set(re.findall(r"\b\w+\b", text.lower()))
        cat_scores: dict[str, float] = {}
        for cat, keywords in kw_map.items():
            kw_set = set(k.lower() for k in keywords)
            if not kw_set:
                continue
            overlap = len(text_words & kw_set)
            # normalise by category keyword set size
            cat_scores[cat] = overlap / len(kw_set)

        if not cat_scores:
            return {"category_confidence": None, "category_flag": False,
                    "category_suggestion": None, "category_flag_reason": None}

        best_cat   = max(cat_scores, key=cat_scores.get)
        best_score = cat_scores[best_cat]

        # Match assigned category loosely
        assigned_lc = assigned_category.lower()
        assigned_score = next((v for k, v in cat_scores.items()
                               if k.lower() == assigned_lc), 0.0)

        if best_score == 0:
            confidence = 1.0  # no signal → assume correct
        else:
            confidence = round(min(1.0, assigned_score / best_score), 2)

        flag = False
        suggestion = None
        reason = None

        if confidence < 0.40 and best_cat.lower() != assigned_lc and best_score > 0:
            flag = True
            suggestion = best_cat
            ratio = round(best_score / max(assigned_score, 0.001), 1)
            reason = (f"Text is {ratio}× more similar to '{best_cat}' "
                      f"than assigned category '{assigned_category}'")
        elif (best_score > 0 and best_cat.lower() != assigned_lc and
              (best_score - assigned_score) / best_score > 0.5):
            flag = True
            suggestion = best_cat
            reason = f"'{best_cat}' matches text significantly better than '{assigned_category}'"

        return {
            "category_confidence":  confidence,
            "category_flag":        flag,
            "category_suggestion":  suggestion,
            "category_flag_reason": reason,
        }


# ---------------------------------------------------------------------------
# Intelligence Engine 4 — Note Pattern Suggestions
# ---------------------------------------------------------------------------
class NotePatternEngine:
    """Returns coaching suggestions for weak note criteria using pattern library."""

    NOTE_CRITERIA = {3, 10, 11, 19, 25, 28, 41}

    @classmethod
    def get_suggestions(cls, ctq_scores: dict, category: str) -> list[dict]:
        weak_ids = [cid for cid in cls.NOTE_CRITERIA
                    if ctq_scores.get(cid, 100) < 60]
        if not weak_ids:
            return []

        suggestions: list[dict] = []
        cat_lc = category.lower().strip()
        try:
            with _db() as con:
                rows = con.execute(
                    """SELECT criterion_id, criterion_name, weak_signal, prompt, strong_example
                       FROM note_patterns
                       WHERE LOWER(category) IN (?, '*')
                       ORDER BY CASE WHEN LOWER(category) = ? THEN 0 ELSE 1 END
                       LIMIT 20""",
                    (cat_lc, cat_lc),
                ).fetchall()
                for row in rows:
                    if int(row["criterion_id"]) in weak_ids and len(suggestions) < 4:
                        suggestions.append({
                            "criterion":         row["criterion_name"],
                            "current_weakness":  row["weak_signal"],
                            "prompt":            row["prompt"],
                            "example":           row["strong_example"],
                        })
        except Exception:
            pass
        return suggestions


# ---------------------------------------------------------------------------
# KB Citation extraction
# ---------------------------------------------------------------------------
_KB_PATTERN = re.compile(r"\bKB\d{4,8}\b", re.I)


def _extract_kb(text: str) -> list[str]:
    return list({m.upper() for m in _KB_PATTERN.findall(text)})


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------
def _compute_anomalies(con) -> None:
    """Compute rolling 8-week anomaly after new batch is inserted."""
    rows = con.execute(
        """SELECT strftime('%Y-W%W', created_at) AS wk, AVG(avg_score) AS avg
           FROM audit_batches GROUP BY wk ORDER BY wk DESC LIMIT 9"""
    ).fetchall()

    if len(rows) < 3:
        return

    recent    = rows[0]
    baseline  = [r["avg"] for r in rows[1:] if r["avg"] is not None]
    if len(baseline) < 2:
        return

    mean = sum(baseline) / len(baseline)
    std  = math.sqrt(sum((x - mean) ** 2 for x in baseline) / len(baseline))
    if std == 0:
        return

    sigma = (recent["avg"] - mean) / std
    if abs(sigma) >= 1.5:
        direction = "drop" if sigma < 0 else "spike"
        con.execute(
            """INSERT INTO anomaly_flags
               (week_start, metric, direction, value, baseline, sigma_delta, created_at)
               VALUES (?, 'avg_score', ?, ?, ?, ?, ?)""",
            (recent["wk"], direction, recent["avg"],
             round(mean, 2), round(sigma, 2), datetime.now(timezone.utc).replace(tzinfo=None).isoformat()),
        )


# ---------------------------------------------------------------------------
# Async K-means automation candidate clustering
# ---------------------------------------------------------------------------
def _run_clustering_async() -> None:
    """Background thread: cluster ticket descriptions for automation candidates."""
    def _task():
        with _cluster_lock:
            _cluster_state["status"] = "running"
        try:
            results = _cluster_tickets()
        except Exception as e:
            log.warning("Clustering failed: %s", e)
            results = []
        with _cluster_lock:
            _cluster_state["status"]     = "done"
            _cluster_state["updated_at"] = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
            _cluster_state["results"]    = results

    threading.Thread(target=_task, daemon=True).start()


def _cluster_tickets() -> list[dict]:
    if not _SKLEARN:
        return []

    with _db() as con:
        rows = con.execute(
            "SELECT at.ticket_number, ab.ticket_type, at.category, at.ctq_scores "
            "FROM audit_tickets at JOIN audit_batches ab ON at.batch_id = ab.id "
            "ORDER BY at.id DESC LIMIT 10000"
        ).fetchall()

    if len(rows) < 30:
        return []

    texts    = [(r["ticket_number"] or "") + " " + (r["ticket_type"] or "") + " " + (r["category"] or "")
                for r in rows]
    cats     = [r["category"] or "Unknown" for r in rows]

    k        = min(12, len(texts) // 10)
    vec      = TfidfVectorizer(max_features=500, stop_words="english")
    X        = vec.fit_transform(texts)
    km       = KMeans(n_clusters=k, n_init=5, random_state=42)
    km.fit(X)

    feature_names = vec.get_feature_names_out()
    results: list[dict] = []
    for cluster_id in range(k):
        mask   = km.labels_ == cluster_id
        count  = int(mask.sum())
        if count < 10:
            continue
        center = km.cluster_centers_[cluster_id]
        top_idx  = center.argsort()[::-1][:6]
        top_terms = [feature_names[i] for i in top_idx]
        cat_counts = Counter(cats[i] for i, m in enumerate(mask) if m)
        dominant   = cat_counts.most_common(1)[0][0]

        # Automation type heuristic
        if any(t in top_terms for t in ["password", "reset", "access", "unlock"]):
            auto_type = "Self-service portal (password reset / access request)"
        elif any(t in top_terms for t in ["printer", "print", "toner"]):
            auto_type = "Scripted resolution (printer self-service)"
        elif any(t in top_terms for t in ["vpn", "network", "wifi", "connect"]):
            auto_type = "Chatbot triage + scripted fix"
        else:
            auto_type = "Scheduled / batch automation candidate"

        results.append({
            "cluster_id":       cluster_id,
            "ticket_count":     count,
            "top_terms":        top_terms,
            "dominant_category": dominant,
            "automation_type":  auto_type,
        })

    # Persist to DB
    with _db() as con:
        con.execute("DELETE FROM automation_clusters")
        for r in results:
            con.execute(
                "INSERT INTO automation_clusters (cluster_id,label,ticket_count,top_terms,automation_type,computed_at) VALUES (?,?,?,?,?,?)",
                (r["cluster_id"], r["dominant_category"], r["ticket_count"],
                 json.dumps(r["top_terms"]), r["automation_type"],
                 datetime.now(timezone.utc).replace(tzinfo=None).isoformat()),
            )
    return results


# ---------------------------------------------------------------------------
# FCR + Repeat Caller helpers
# ---------------------------------------------------------------------------
def _detect_fcr(con, caller: str, category: str, opened_at: str) -> bool:
    """Return True if this caller+category pair reopened within 7 days."""
    if not caller or not opened_at:
        return False
    try:
        opened = datetime.fromisoformat(opened_at[:19])
    except Exception:
        return False
    window_start = (opened - timedelta(days=7)).isoformat()
    row = con.execute(
        """SELECT COUNT(*) AS cnt FROM audit_tickets at
           JOIN audit_batches ab ON at.batch_id = ab.id
           WHERE at.caller = ? AND at.category = ?
             AND ab.created_at > ? AND ab.created_at < ?""",
        (caller, category, window_start, opened_at),
    ).fetchone()
    return (row["cnt"] if row else 0) > 0


def _caller_history_count(con, caller: str) -> int:
    """Count how many times this caller appears in last 30 days."""
    if not caller:
        return 0
    cutoff = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)).isoformat()
    row = con.execute(
        "SELECT COUNT(*) AS cnt FROM audit_tickets at "
        "JOIN audit_batches ab ON at.batch_id = ab.id "
        "WHERE at.caller = ? AND ab.created_at > ?",
        (caller, cutoff),
    ).fetchone()
    return row["cnt"] if row else 0


def _refresh_repeat_callers(con) -> None:
    """Rebuild repeat_callers table for the last 30 days."""
    cutoff = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)).isoformat()
    rows = con.execute(
        """SELECT at.caller, at.category, COUNT(*) AS cnt
           FROM audit_tickets at
           JOIN audit_batches ab ON at.batch_id = ab.id
           WHERE at.caller IS NOT NULL AND at.caller != ''
             AND ab.created_at > ?
           GROUP BY at.caller
           HAVING cnt >= 3""",
        (cutoff,),
    ).fetchall()
    con.execute("DELETE FROM repeat_callers")
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    for row in rows:
        cat_row = con.execute(
            "SELECT at.category, COUNT(*) AS cnt FROM audit_tickets at "
            "JOIN audit_batches ab ON at.batch_id = ab.id "
            "WHERE at.caller = ? AND ab.created_at > ? GROUP BY at.category ORDER BY cnt DESC LIMIT 3",
            (row["caller"], cutoff),
        ).fetchall()
        cats = [r["category"] for r in cat_row if r["category"]]
        con.execute(
            "INSERT INTO repeat_callers (caller,window_start,window_end,ticket_count,categories,computed_at) VALUES (?,?,?,?,?,?)",
            (row["caller"], cutoff, now, row["cnt"], json.dumps(cats), now),
        )


# ---------------------------------------------------------------------------
# Email notifications on batch completion
# ---------------------------------------------------------------------------
def _send_batch_completion_email(batch_id: int, processed: int, avg_score: float, pass_rate: float, username: str) -> None:
    """Send email notification when batch scoring completes."""
    if not app.config.get('MAIL_ENABLED') or not _MAIL_AVAILABLE or not mail:
        return

    try:
        recipients_str = os.getenv('MAIL_NOTIFICATION_RECIPIENTS', '')
        if not recipients_str:
            log.debug("No email recipients configured (MAIL_NOTIFICATION_RECIPIENTS)")
            return

        recipients = [r.strip() for r in recipients_str.split(',') if r.strip()]
        if not recipients:
            return

        subject = f"CTQ Audit Batch #{batch_id} Complete — {processed} tickets, {pass_rate:.1f}% pass rate"
        
        # Create plain text and HTML emails
        text_body = f"""
CTQ Audit Batch Completed

Batch ID: {batch_id}
Processed by: {username}
Timestamp: {datetime.now(timezone.utc).replace(tzinfo=None).isoformat()}

Results:
  - Tickets processed: {processed}
  - Average score: {avg_score:.1f} / 100
  - Pass rate: {pass_rate:.1f}%

Please log in to the CTQ Enterprise platform to review detailed results and coaching plans.

---
YK CTQ Audit Intelligence Platform
http://localhost:8745
"""

        html_body = f"""
<html><body style="font-family: Segoe UI, Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #00d4ff;">CTQ Audit Batch Completed</h2>
    <p>Your batch audit has finished processing.</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Batch ID</td>
            <td style="padding: 10px;">{batch_id}</td>
        </tr>
        <tr>
            <td style="padding: 10px; font-weight: bold;">Processed by</td>
            <td style="padding: 10px;">{username}</td>
        </tr>
        <tr style="background: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold;">Timestamp</td>
            <td style="padding: 10px;">{datetime.now(timezone.utc).replace(tzinfo=None).isoformat()}</td>
        </tr>
    </table>
    
    <h3 style="color: #00d4ff;">Results</h3>
    <ul style="font-size: 14px;">
        <li><strong>Tickets processed:</strong> {processed}</li>
        <li><strong>Average score:</strong> {avg_score:.1f} / 100</li>
        <li><strong>Pass rate:</strong> {pass_rate:.1f}%</li>
    </ul>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        Log in to the <strong>CTQ Enterprise platform</strong> to review detailed results and coaching plans.<br/>
        <a href="http://localhost:8745" style="color: #00d4ff;">http://localhost:8745</a>
    </p>
</div>
</body></html>
"""

        msg = Message(
            subject=subject,
            recipients=recipients,
            body=text_body,
            html=html_body
        )
        
        mail.send(msg)
        log.info(f"Batch completion email sent to {len(recipients)} recipients (batch_id={batch_id})")
        
    except Exception as e:
        log.warning(f"Failed to send batch completion email: {e}")


# ---------------------------------------------------------------------------
# Seeding — note pattern library
# ---------------------------------------------------------------------------
_DEFAULT_PATTERNS = [
    # Access
    ("access", 3, "Work Notes Documentation", "Note is too vague (e.g., 'reset done')",
     "Add: who requested, what system, verification step",
     "Reset AD password per caller request for Office365. Tested: user confirmed login successful via Teams call."),
    ("access", 28, "Troubleshooting Steps", "No troubleshooting detail",
     "Add: tool used, what was checked, outcome",
     "Checked AD account — locked out due to 5 failed attempts. Unlocked via ADUC. User confirmed access restored."),
    ("access", 41, "Resolution Documentation", "Resolution notes missing or too short",
     "Add: root cause, steps taken, outcome verified",
     "Root cause: account lock policy triggered after 5 failed VPN attempts. Unlocked account, reset password, confirmed with user."),

    # Hardware
    ("hardware", 3, "Work Notes Documentation", "Note says 'replaced part' with no detail",
     "Add: part number, fault symptom, test outcome",
     "Replaced toner cartridge (CLT-K504S). Original fault: paper jam + faint print. Post-fix: test page printed cleanly."),
    ("hardware", 25, "Problem Description Quality", "Symptom not fully described",
     "Add: error message, frequency, affected devices, user impact",
     "User reports blue screen (IRQL_NOT_LESS_OR_EQUAL) on startup, occurring 3×/day. Affects WKST-042 only. 2 other users on same floor unaffected."),
    ("hardware", 28, "Troubleshooting Steps", "No diagnostic steps recorded",
     "Add: diagnostics run, tools used, findings",
     "Ran hardware diagnostics (Dell SupportAssist) — HDD S.M.A.R.T. failure detected. Replaced HDD with spare (SN: XF72819). Restored from backup. Verified."),
    ("hardware", 41, "Resolution Documentation", "Vague resolution — no component detail",
     "Add: component replaced/repaired, serial number, test result",
     "Replaced faulty RAM stick (Slot A, 8GB DDR4). System ran Memtest86 — 0 errors in 2 passes. User confirmed no crashes in 30-min session."),

    # Software
    ("software", 3, "Work Notes Documentation", "Note says 'reinstalled app' with no context",
     "Add: version before/after, root cause, prevention note",
     "Uninstalled Outlook v16.0.12 (corrupt profile). Clean install v16.0.17. Root cause: profile corruption after KB5034441. User advised not to close during updates."),
    ("software", 28, "Troubleshooting Steps", "Steps unclear or missing",
     "Add: what was tried, what succeeded, what failed",
     "1) Cleared temp files — no change. 2) Ran SFC /scannow — corrupt system file found and repaired. 3) Reboot — application launched successfully."),
    ("software", 19, "Detailed Description", "Description too short",
     "Add: error message, steps to reproduce, frequency, impact",
     "User receives 'Error 0x800f0954' when running Windows Update. Occurs every update attempt since 15 Apr. Blocking security patches."),
    ("software", 41, "Resolution Documentation", "No root cause or fix detail",
     "Add: what caused the issue, fix applied, how verified",
     "Root cause: missing .NET 4.8 dependency. Installed via Windows Features. Confirmed application launches and processes forms without error."),

    # Network
    ("network", 3, "Work Notes Documentation", "Note says 'checked network' — no detail",
     "Add: tool used, test output, scope of impact",
     "Ran ping/tracert to 8.8.8.8. 30% packet loss on switch port 14. Isolated to single port — remapped to port 15. User confirmed connectivity restored."),
    ("network", 28, "Troubleshooting Steps", "No network diagnostic recorded",
     "Add: ping/tracert results, port/switch details, outcome",
     "1) Ping test: 40% loss. 2) Checked switch (Cisco 2960): Port 14 CRC errors. 3) Replaced patch lead — errors cleared. 4) User confirmed."),
    ("network", 19, "Detailed Description", "Incident scope not clear",
     "Add: affected users/devices, location, error message",
     "Intermittent WiFi drops affecting 8 users on Floor 3, Building B. 'Limited connectivity' shown. Started 09:45 today. Wired users unaffected."),

    # Email
    ("email", 3, "Work Notes Documentation", "Work note missing email-specific detail",
     "Add: email server/client, specific error, steps taken",
     "User unable to receive emails — inbox stuck at 09:15. Checked Exchange: mailbox quota at 99.8%. Archived 2GB to PST. Quota now 61%. Receiving confirmed."),
    ("email", 28, "Troubleshooting Steps", "Troubleshooting not documented",
     "Add: what was checked in admin portal, what was found, fix applied",
     "1) Checked Exchange Admin — delivery queue clear. 2) Verified MX records — correct. 3) Removed corrupted rule in OWA. 4) User confirmed receiving."),
    ("email", 10, "Email Communication Format", "Response missing greeting or sign-off",
     "Start with greeting, end with professional sign-off",
     "Dear [Name], Thank you for contacting IT Support. Your issue has been resolved as detailed above. Kind regards, IT Service Desk."),

    # Printer
    ("printer", 3, "Work Notes Documentation", "Note says 'fixed printer' with no detail",
     "Add: printer make/model, fault, fix, test",
     "HP LaserJet Pro M404n (PRINT-FL3-01) showing offline. Cleared print queue, restarted Print Spooler. Confirmed test page printed. Drivers up to date."),
    ("printer", 28, "Troubleshooting Steps", "No printer diagnostic steps",
     "Add: error state, steps checked, outcome",
     "1) Printer offline — power cycled. 2) Cleared stuck job in queue. 3) Reinstalled driver (HP Universal Print Driver 7.0.1). 4) Test page printed OK."),
    ("printer", 19, "Detailed Description", "Missing printer details",
     "Add: printer name/model, error code, location, impact (how many users)",
     "HP LaserJet Pro MFP M428fdn on Floor 2 (asset PRNT-0042) showing 'Paper Jam 13.A3'. Affecting 6 users. Error persists after clearing tray."),

    # Generic (applies to all)
    ("*", 10, "Email Communication Format", "Email lacks greeting or professional close",
     "Open with greeting, close with name/team signature",
     "Hi [Caller Name], Thank you for getting in touch with IT Support. [Body]. Please let us know if you need further assistance. Kind regards, [Your Name] — IT Service Desk."),
    ("*", 11, "Communication Quality", "Response too brief — insufficient information",
     "Aim for at least 30 words, include what was done and next steps",
     "We have investigated your reported issue and applied the following fix: [detail]. Your service has been restored as of [time]. If the issue recurs, please reopen this ticket."),
    ("*", 32, "SLA/Update Communication", "No SLA or timeline communicated to user",
     "Tell the user when to expect next update or resolution",
     "We are currently investigating this issue and aim to have a resolution within 4 hours. You will receive an update by 15:00 today. If urgent, call x4444."),
    ("*", 25, "Problem Description Quality", "Description lacks error message or reproduction steps",
     "Document: what the user sees, when it started, frequency, any error codes",
     "User reports: 'Cannot open Excel files from SharePoint' — error message: 'Sorry, we can't open this location'. Started Monday. Affects all .xlsx files. Other Office apps work fine."),
]


def _seed_note_patterns() -> None:
    with _db() as con:
        count = con.execute("SELECT COUNT(*) AS cnt FROM note_patterns").fetchone()["cnt"]
        if count > 0:
            return
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        con.executemany(
            """INSERT INTO note_patterns
               (category, criterion_id, criterion_name, weak_signal, prompt, strong_example, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [(cat, cid, cname, ws, pr, ex, now, now)
             for cat, cid, cname, ws, pr, ex in _DEFAULT_PATTERNS],
        )
    log.info("Seeded %d note patterns", len(_DEFAULT_PATTERNS))


# ---------------------------------------------------------------------------
# Python CTQ Scoring Engine — mirrors scoring-engine.js / config-manager.js
# ---------------------------------------------------------------------------
class PyCTQEngine:
    """Pure-Python 42-criterion CTQ engine — v4.0 enhanced."""

    PILLAR_MAP = {
        1:"Consistent Quality",  2:"Productivity",         3:"Compliance",
        4:"Consistent Quality",  5:"CSAT/Retention",       6:"Compliance",
        7:"Risk Management",     8:"Consistent Quality",   9:"Consistent Quality",
        10:"CSAT/Retention",    11:"CSAT/Retention",      12:"CSAT/Retention",
        13:"Training & Coaching",14:"Compliance",          15:"Consistent Quality",
        16:"Consistent Quality", 17:"Productivity",        18:"Risk Management",
        19:"Consistent Quality", 20:"Compliance",          21:"CSAT/Retention",
        22:"Productivity",       23:"CSAT/Retention",      24:"Continuous Improvement",
        25:"Continuous Improvement",26:"Productivity",     27:"Continuous Improvement",
        28:"Continuous Improvement",29:"Productivity",     30:"CSAT/Retention",
        31:"Training & Coaching",32:"CSAT/Retention",     33:"Risk Management",
        34:"Compliance",         35:"Compliance",          36:"Risk Management",
        37:"Risk Management",    38:"Compliance",          39:"Continuous Improvement",
        40:"Risk Management",    41:"Productivity",        42:"Compliance",
    }

    @classmethod
    def score(cls, ticket: dict, compliance_threshold: float = 75.0,
              caller_history: int = 0) -> dict:
        f = cls._normalise(ticket)
        scores: dict[int, float] = {cid: cls._evaluate(cid, f) for cid in range(1, 43)}

        total_weight = 40 * 2.38 + 2 * 2.40
        weighted_sum = sum(scores[i] * (2.38 if i <= 40 else 2.40) for i in range(1, 43))
        overall = min(100.0, weighted_sum / total_weight)

        pillar_totals: dict[str, list] = {}
        for cid, sc in scores.items():
            p = cls.PILLAR_MAP.get(cid, "Other")
            pillar_totals.setdefault(p, []).append(sc)
        pillar_scores = {p: round(sum(v) / len(v), 1) for p, v in pillar_totals.items()}

        neg_ids   = [cid for cid, sc in scores.items() if sc < 60]
        pos_count = sum(1 for sc in scores.values() if sc >= 85)

        # 7-dimension sentiment
        all_text = f["wn"] + " " + f["ac"] + " " + f["desc"] + " " + f["rn"]
        sentiment_profile = SentimentEngine.analyse(
            all_text, caller=f["caller"],
            priority=f["pri"], caller_history_count=caller_history
        )

        # Resolution integrity
        ri = ResolutionIntegrityEngine.score(f["rn"], f["rc"], f["state"])

        # Category quality
        cq = CategoryQualityEngine.score(f["sd"] + " " + f["desc"], f["cat"])

        # Note suggestions
        suggestions = NotePatternEngine.get_suggestions(scores, f["cat"])

        return {
            **ticket,
            "overall_score":          round(overall, 1),
            "grade":                  cls._grade(overall),
            "compliance_pass":        overall >= compliance_threshold,
            "ctq_scores":             scores,
            "pillar_scores":          pillar_scores,
            "sentiment":              sentiment_profile["sentiment_type"],
            "sentiment_reason":       sentiment_profile["sentiment_reason"],
            "sentiment_profile":      sentiment_profile,
            "resolution_integrity":   ri["resolution_integrity"],
            "resolution_integrity_detail": ri,
            "category_confidence":    cq["category_confidence"],
            "category_flag":          cq["category_flag"],
            "category_suggestion":    cq["category_suggestion"],
            "category_flag_reason":   cq["category_flag_reason"],
            "note_suggestions":       suggestions,
            "positive_criteria_count": pos_count,
            "negative_criteria_count": len(neg_ids),
            "coaching_notes":         cls._coaching(neg_ids),
            "audited_at":             datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "engine_version":         APP_VERSION,
        }

    @staticmethod
    def _normalise(t: dict) -> dict:
        def s(k): return str(t.get(k) or "").strip()
        def wc(text): return len(text.split()) if text.strip() else 0
        return {
            "wn": s("work_notes"),        "ac": s("additional_comments"),
            "desc": s("description"),     "rn": s("resolution_notes"),
            "sd": s("short_description"), "cat": s("category"),
            "sub": s("subcategory"),      "ci": s("configuration_item"),
            "pri": s("priority"),         "state": s("state"),
            "rc": s("resolution_code"),   "ku": s("knowledge_used"),
            "ag": s("assigned_to") or s("agent"),
            "group": s("assignment_group"), "caller": s("caller"),
            "reass": int(t.get("reassignment_count") or 0),
            "sc": int(t.get("strike_count") or 0),
            "ss": s("start_strike"),      "opened": s("opened"),
            "wc": wc,
        }

    @staticmethod
    def _evaluate(cid: int, f: dict) -> float:
        wc = f["wc"]
        def m(pattern, text, fl=re.I): return bool(re.search(pattern, text, fl))

        if cid == 1:  return 100 if len(f["cat"]) > 2 else 0
        if cid == 2:
            if m(r"self.?service|user guide|kb|knowledge base|faq|portal", f["wn"]+f["ac"]+f["rn"]): return 100
            return 80 if "self" in f["cat"].lower() else 50
        if cid == 3:
            n = wc(f["wn"]); return 0 if not f["wn"] else (30 if n<10 else (65 if n<30 else (85 if n<80 else 100)))
        if cid == 4:  return 100 if m(r"screenshot|attachment|attached|image|snip|capture", f["wn"]+f["ac"]) else 40
        if cid == 5:  return 95 if m(r"per your request|as discussed|following up|please find|as agreed", f["ac"]) else (80 if wc(f["ac"])>20 else 30)
        if cid == 6:
            st = f["state"].lower(); return 0 if not f["state"] else (
                (100 if f["rn"] else 40) if m(r"resolv|clos", st) else
                (50 if m(r"hold", st) and not m(r"awaiting|waiting|pending|3rd party|vendor", f["wn"]+f["ac"]) else 85))
        if cid == 7:  return 100 if f["ci"] else 0
        if cid == 8:  return 100 if (f["group"] and f["cat"]) else (70 if (f["group"] or f["cat"]) else 20)
        if cid == 9:  return 100 if (f["cat"] and f["sub"]) else (60 if f["cat"] else 0)
        if cid == 10:
            if not f["ac"]: return 0
            g = m(r"dear|hello|hi |good morning|good afternoon|thank you|thanks for", f["ac"])
            s = m(r"regards|sincerely|kind regards|best regards|IT support|service desk", f["ac"])
            return 100 if (g and s) else (70 if (g or s) else 40)
        if cid == 11:
            n = wc(f["ac"]); return 0 if not f["ac"] else (30 if n<10 else (65 if n<30 else 100))
        if cid == 12:
            g = m(r"dear|hello|hi |good morning|good afternoon", f["ac"])
            s = m(r"regards|sincerely|kind regards|best regards", f["ac"])
            return 100 if (g and s) else (70 if (g or s) else 20)
        if cid == 13:
            if not f["ac"]: return 70
            if m(r"\blol\b|\bwtf\b|\bomg\b|\bbrb\b", f["ac"]): return 20
            return 40 if m(r"\bu r\b|cant |wont |didnt |gonna|wanna|\bpls\b|\bplz\b", f["ac"]) else 95
        if cid == 14: return 0 if m(r"jira|confluence|admin password|root password|server ip|\\\\[a-z]", f["ac"]) else 100
        if cid == 15:
            filled = sum(1 for x in [f["cat"],f["sub"],f["ci"],f["pri"],f["state"],f["ag"],f["group"],f["rc"]] if x)
            return round(filled/8*100)
        if cid == 16: return 100 if (f["caller"] and f["ag"]) else (60 if (f["caller"] or f["ag"]) else 0)
        if cid == 17:
            n = wc(f["sd"]); return 0 if not f["sd"] else (20 if n<3 else (60 if n<6 else (70 if n>20 else 100)))
        if cid == 18: return 100 if f["pri"] else 0
        if cid == 19:
            t = wc(f["desc"])+wc(f["wn"]); return 0 if t==0 else (30 if t<20 else (65 if t<60 else 100))
        if cid == 20: return 100 if (f["ag"] and f["group"]) else (70 if f["ag"] else (60 if f["group"] else 0))
        if cid == 21: return 90
        if cid == 22:
            r = f["reass"]; return 100 if r==0 else (80 if r<=1 else (50 if r<=3 else 10))
        if cid == 23: return 100 if m(r"contacted|called|emailed|reached out|sent update|follow.?up", f["wn"]+f["ac"]) else (70 if f["ac"] else 30)
        if cid == 24: return 100 if m(r"previous|history|prior|earlier|similar|recurrence|same issue|duplicate", f["wn"]+f["desc"]) else 40
        if cid == 25: return 100 if m(r"what happened|when did|how long|error message|steps to reproduce|impact|affected users", f["wn"]+f["desc"]+f["ac"]) else (70 if wc(f["desc"])>30 else 30)
        if cid == 26: return 40 if m(r"is your computer on|have you tried turning|what colour|what model year", f["wn"]+f["ac"]) else 90
        if cid == 27:
            if m(r"true|yes|1", f["ku"]) or m(r"kb\d+|knowledge base|knowledge article|per kb", f["wn"]+f["rn"]): return 100
            return 10 if m(r"false|no|0", f["ku"]) else 40
        if cid == 28:
            hits = re.findall(r"restart|reboot|reset|reinstall|update|patch|clear cache|log off|reconfigure|tested|verified|confirmed", f["wn"]+f["rn"], re.I)
            return 100 if len(hits)>=3 else (70 if hits else (55 if wc(f["wn"])>20 else 20))
        if cid == 29:
            return 30 if (m(r"on hold", f["state"]) and not m(r"awaiting|waiting for|on hold for", f["wn"]+f["ac"])) else 90
        if cid == 30:
            if not f["opened"]: return 80
            try:
                d = datetime.fromisoformat(f["opened"][:19])
                if d.weekday()>=5 or d.hour<8 or d.hour>18: return 50
            except Exception: pass
            return 80
        if cid == 31: return 100 if m(r"please note|for future|you can|next time|recommend|prevent|self.?service|portal", f["ac"]+f["rn"]) else 40
        if cid == 32: return 100 if m(r"will be|by end of|within \d|target|timeline|sla|xla|update you|notify", f["ac"]+f["wn"]) else 35
        if cid == 33: return 10 if m(r"incorrect kb|wrong kb|wrong article|kb not applicable", f["wn"]) else 95
        if cid == 34:
            return 100 if (m(r"kb\d+|attached kb|knowledge attached", f["wn"]+f["rn"]) or m(r"true|yes", f["ku"])) else 20
        if cid == 35:
            if f["sc"]>0 or m(r"true|yes", f["ss"]): return 100
            try:
                old = (datetime.now(timezone.utc).replace(tzinfo=None) - datetime.fromisoformat(f["opened"][:19])).days > 5 if f["opened"] else False
            except Exception: old = False
            return 50 if old else 85
        if cid == 36: return 10 if m(r"incorrect strike|wrong strike|strike error|premature strike", f["wn"]) else 95
        if cid == 37:
            if m(r"vip|executive|director|ceo|cto|board|priority user", f["caller"]+f["desc"]+f["wn"]):
                return 100 if m(r"manual strike|vip process|approved strike", f["wn"]) else 40
            return 90
        if cid == 38:
            if not m(r"hold", f["state"]): return 90
            return 100 if m(r"awaiting user|awaiting vendor|third party|3rd party|awaiting approval|pending user", f["wn"]+f["ac"]) else 20
        if cid == 39: return 100 if m(r"sme|subject matter|specialist|escalated to|l2|l3|level 2|level 3|senior|lead", f["wn"]+f["ac"]) else (60 if f["reass"]>1 else 70)
        if cid == 40: return 20 if m(r"wrong form|incorrect type|should be sr|should be incident|reclassified|converted to", f["wn"]) else 90
        if cid == 41:
            total = wc(f["rn"])+wc(f["wn"])
            if not f["rn"] and m(r"resolv|clos", f["state"]): return 0
            return 100 if (f["rc"] and total>20) else (70 if f["rc"] else 40)
        if cid == 42: return 100 if m(r"approved by|lead approved|sme approved|signed off|reviewed by|authorised by|stamp", f["wn"]) else 60
        return 100

    @staticmethod
    def _grade(score: float) -> str:
        if score >= 85: return "Excellent"
        if score >= 70: return "Good"
        if score >= 50: return "Fair"
        return "Poor"

    @staticmethod
    def _coaching(neg_ids: list) -> str:
        if not neg_ids:
            return "Excellent performance across all CTQ criteria. Continue best practices."
        name_map = {
            1:"Ticket Categorisation",  3:"Work Notes Documentation",
            10:"Email Format",          14:"Internal Info Exposure",
            15:"Accurate Field Updates",17:"Short Description",
            19:"Detailed Description",  27:"KB Reference Usage",
            28:"Troubleshooting Steps", 34:"KB Attachment",
            41:"Resolution Documentation",
        }
        names = [name_map.get(i, f"Criterion {i}") for i in neg_ids[:3]]
        return f"Focus coaching on: {', '.join(names)}. These areas scored below 60."


# ---------------------------------------------------------------------------
# Frontend routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(BASE_DIR, path)


# ---------------------------------------------------------------------------
# API authorization — every /api/* route requires an active session except
# the three auth endpoints themselves. This was previously missing entirely:
# the login screen only gated the browser UI, and every business endpoint
# (audit scoring, history, note patterns, logs, ...) was reachable by anyone
# with network access to the server, session or no session. See
# tests/test_health.py::test_protected_routes_require_auth for the
# regression test that guards this.
# ---------------------------------------------------------------------------
PUBLIC_API_ROUTES = {
    "/api/auth/login",
    "/api/auth/session",
    "/api/auth/logout",
    "/api/health",  # conventionally public for monitoring/liveness checks
}


@app.before_request
def _require_auth():
    path = request.path
    if path.startswith("/api/") and path not in PUBLIC_API_ROUTES:
        if "username" not in session:
            log.warning("Unauthenticated request blocked: %s %s", request.method, path)
            return jsonify({"success": False, "error": "Authentication required"}), 401


# ---------------------------------------------------------------------------
# API — Authentication
# ---------------------------------------------------------------------------
@app.errorhandler(429)
def _rate_limit_exceeded(e):
    log.warning("Rate limit exceeded: %s %s from %s", request.method, request.path, get_remote_address() if _LIMITER_AVAILABLE else "?")
    return jsonify({"success": False, "error": "Too many attempts. Please try again later."}), 429


@app.route("/api/auth/login", methods=["POST"])
@_rate_limited("5 per minute")
def login():
    """Authenticate user with bcrypt password verification."""
    try:
        data = request.json or {}
        username = data.get("username", "").lower().strip()
        password = data.get("password", "")
        
        if not username or not password:
            log.warning("Login attempt with missing credentials")
            return jsonify({"success": False, "error": "Missing username or password"}), 400
        
        user = USERS.get(username)
        if not user:
            log.warning("Login attempt for non-existent user: %s", username)
            return jsonify({"success": False, "error": "Invalid credentials"}), 401
        
        # Verify password using bcrypt
        if not _verify_password(user["password_hash"], password):
            log.warning("Failed login attempt for user: %s", username)
            return jsonify({"success": False, "error": "Invalid credentials"}), 401
        
        # Session is stored server-side; client gets secure httponly cookie
        session.permanent = True
        session['username'] = username
        session['role'] = user['role']
        session['displayName'] = user['displayName']
        
        log.info("User logged in: %s (role: %s)", username, user['role'])
        return jsonify({"success": True, "user": {
            "username": username,
            "displayName": user["displayName"],
            "role": user["role"],
        }}), 200
    except Exception as e:
        log.exception("Login error")
        return jsonify({"success": False, "error": "Internal server error"}), 500


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """Clear user session."""
    username = session.get('username', 'unknown')
    session.clear()
    log.info("User logged out: %s", username)
    return jsonify({"success": True, "message": "Logged out successfully"}), 200


@app.route("/api/auth/session", methods=["GET"])
def check_session():
    """Check if user has active session."""
    if 'username' in session:
        return jsonify({"authenticated": True, "user": {
            "username": session.get('username'),
            "displayName": session.get('displayName'),
            "role": session.get('role'),
        }}), 200
    return jsonify({"authenticated": False}), 401


# ---------------------------------------------------------------------------
# API — Single ticket scoring
# ---------------------------------------------------------------------------
@app.route("/api/audit/score", methods=["POST"])
def score_ticket():
    try:
        return jsonify(PyCTQEngine.score(request.json or {}))
    except Exception as e:
        log.exception("Scoring error")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API — Batch scoring (v4.0 — stores new fields, detects FCR, repeat callers)
# ---------------------------------------------------------------------------
@app.route("/api/audit/batch", methods=["POST"])
def batch_score():
    """Batch score multiple tickets with comprehensive error handling."""
    try:
        payload     = request.json or {}
        tickets     = payload.get("tickets", [])
        ticket_type = payload.get("ticket_type", "unknown")
        username    = payload.get("username", "anonymous")
        threshold   = float(payload.get("compliance_threshold", 75))

        if not tickets:
            return jsonify({"error": "No tickets provided"}), 400
        if len(tickets) > 5000:
            return jsonify({"error": "Batch limit is 5,000 tickets per request"}), 400

        results = []
        with _db() as con:
            for t in tickets:
                caller  = str(t.get("caller") or "").strip()
                history = _caller_history_count(con, caller)
                r = PyCTQEngine.score(t, compliance_threshold=threshold,
                                      caller_history=history)
                # FCR detection
                cat    = str(t.get("category") or "").strip()
                opened = str(t.get("opened") or "").strip()
                r["fcr_fail"] = _detect_fcr(con, caller, cat, opened)
                results.append(r)

            avg       = sum(r["overall_score"] for r in results) / len(results)
            passes    = sum(1 for r in results if r["compliance_pass"])
            pass_rate = round(passes / len(results) * 100, 2)

            cur      = con.execute(
                "INSERT INTO audit_batches (created_at,username,ticket_type,row_count,avg_score,pass_rate) VALUES (?,?,?,?,?,?)",
                (datetime.now(timezone.utc).replace(tzinfo=None).isoformat(), username, ticket_type,
                 len(results), round(avg, 2), pass_rate),
            )
            batch_id = cur.lastrowid

            for r in results:
                cur2 = con.execute(
                    """INSERT INTO audit_tickets
                       (batch_id, ticket_number, overall_score, grade, compliance_pass,
                        sentiment, pillar_scores, ctq_scores, coaching_notes, audited_at,
                        caller, category, resolution_code, assigned_to,
                        sentiment_profile, category_confidence, category_flag,
                        category_suggestion, resolution_integrity, fcr_fail, note_suggestions)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        batch_id,
                        r.get("number", "") or r.get("ticket_id", ""),
                        r["overall_score"], r["grade"], int(r["compliance_pass"]),
                        r["sentiment"],
                        json.dumps(r["pillar_scores"]),
                        json.dumps(r["ctq_scores"]),
                        r["coaching_notes"], r["audited_at"],
                    r.get("caller", ""), r.get("category", ""),
                    r.get("resolution_code", ""),
                    r.get("assigned_to") or r.get("agent", ""),
                    json.dumps(r.get("sentiment_profile", {})),
                    r.get("category_confidence"),
                    int(r.get("category_flag", False)),
                    r.get("category_suggestion"),
                    r.get("resolution_integrity"),
                    int(r.get("fcr_fail", False)),
                    json.dumps(r.get("note_suggestions", [])),
                ),
            )
            ticket_db_id = cur2.lastrowid

            # KB citations
            all_text = (r.get("work_notes") or "") + " " + (r.get("resolution_notes") or "")
            for kb in _extract_kb(all_text):
                con.execute(
                    "INSERT INTO kb_citations (batch_id,ticket_id,kb_article,category,audited_at) VALUES (?,?,?,?,?)",
                    (batch_id, ticket_db_id, kb, r.get("category", ""),
                     r["audited_at"]),
                )

        _compute_anomalies(con)
        _refresh_repeat_callers(con)

        # Trigger async clustering
        _run_clustering_async()

        log.info("Batch scored: %d tickets, avg=%.1f, pass_rate=%.1f%%", len(results), avg, pass_rate)
        return jsonify({
            "batch_id":  batch_id,
            "processed": len(results),
            "avg_score": round(avg, 2),
            "pass_rate": pass_rate,
            "results":   results,
        }), 200

    except ValueError as e:
        log.warning("Batch scoring validation error: %s", e)
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        log.exception("Batch scoring error")
        return jsonify({"error": "Batch scoring failed. Check server logs."}), 500


# ---------------------------------------------------------------------------
# API — History: weekly trends
# ---------------------------------------------------------------------------
@app.route("/api/history/trends", methods=["GET"])
def history_trends():
    try:
        weeks = int(request.args.get("weeks", 52))
        with _db() as con:
            rows = con.execute(
                """SELECT
                       strftime('%Y-W%W', created_at) AS week,
                       COUNT(*) AS batch_count,
                       SUM(row_count) AS ticket_count,
                       ROUND(AVG(avg_score), 2) AS avg_score,
                       ROUND(AVG(pass_rate), 2) AS avg_pass_rate,
                       MIN(created_at) AS week_start
                   FROM audit_batches
                   GROUP BY week
                   ORDER BY week DESC
                   LIMIT ?""",
                (weeks,),
            ).fetchall()

            # Anomaly flags
            flags = con.execute(
                "SELECT week_start, direction, sigma_delta FROM anomaly_flags ORDER BY created_at DESC LIMIT 52"
            ).fetchall()
            flag_map = {r["week_start"]: {"direction": r["direction"], "sigma": r["sigma_delta"]}
                        for r in flags}

        data = []
        for r in rows:
            week = r["week"]
            entry = dict(r)
            entry["anomaly"] = flag_map.get(week)
            data.append(entry)

        return jsonify(data)
    except Exception as e:
        log.exception("History trends error")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API — History: agent summaries (paginated, worst first)
# ---------------------------------------------------------------------------
@app.route("/api/history/agents", methods=["GET"])
def history_agents():
    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = 20
        offset = (page - 1) * limit
        weeks = int(request.args.get("weeks", 8))
        cutoff = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(weeks=weeks)).isoformat()

        with _db() as con:
            total = con.execute(
                "SELECT COUNT(DISTINCT assigned_to) AS cnt FROM audit_tickets at "
                "JOIN audit_batches ab ON at.batch_id = ab.id "
                "WHERE ab.created_at > ? AND at.assigned_to != ''",
                (cutoff,),
            ).fetchone()["cnt"]

            rows = con.execute(
                """SELECT
                       at.assigned_to AS agent,
                       COUNT(*) AS ticket_count,
                       ROUND(AVG(at.overall_score), 2) AS avg_score,
                       ROUND(AVG(CASE WHEN at.compliance_pass = 1 THEN 100.0 ELSE 0 END), 1) AS compliance_rate,
                       ROUND(AVG(CASE WHEN at.fcr_fail = 1 THEN 100.0 ELSE 0 END), 1) AS fcr_fail_rate
                   FROM audit_tickets at
                   JOIN audit_batches ab ON at.batch_id = ab.id
                   WHERE ab.created_at > ? AND at.assigned_to != ''
                   GROUP BY at.assigned_to
                   ORDER BY avg_score ASC
                   LIMIT ? OFFSET ?""",
                (cutoff, limit, offset),
            ).fetchall()

        return jsonify({
            "agents":     [dict(r) for r in rows],
            "page":       page,
            "per_page":   limit,
            "total":      total,
            "total_pages": math.ceil(total / limit),
        })
    except Exception as e:
        log.exception("History agents error")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API — History: anomaly flags
# ---------------------------------------------------------------------------
@app.route("/api/history/anomalies", methods=["GET"])
def history_anomalies():
    try:
        with _db() as con:
            rows = con.execute(
                "SELECT * FROM anomaly_flags ORDER BY created_at DESC LIMIT 52"
            ).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        log.exception("Anomalies error")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API — Ad-hoc sentiment analysis
# ---------------------------------------------------------------------------
@app.route("/api/analyse/sentiment", methods=["POST"])
def analyse_sentiment():
    try:
        data   = request.json or {}
        text   = data.get("text", "")
        caller = data.get("caller", "")
        pri    = data.get("priority", "")
        if not text:
            return jsonify({"error": "text field required"}), 400
        result = SentimentEngine.analyse(text, caller=caller, priority=pri)
        return jsonify(result)
    except Exception as e:
        log.exception("Sentiment error")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# API — Note pattern library (CRUD)
# ---------------------------------------------------------------------------
@app.route("/api/patterns/notes", methods=["GET"])
def get_note_patterns():
    try:
        category = request.args.get("category", "")
        with _db() as con:
            if category:
                rows = con.execute(
                    "SELECT * FROM note_patterns WHERE LOWER(category) = ? OR category = '*' ORDER BY category, criterion_id",
                    (category.lower(),),
                ).fetchall()
            else:
                rows = con.execute("SELECT * FROM note_patterns ORDER BY category, criterion_id").fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        log.exception("Get patterns error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/patterns/notes", methods=["POST"])
def create_note_pattern():
    try:
        data = request.json or {}
        now  = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        with _db() as con:
            cur = con.execute(
                """INSERT INTO note_patterns
                   (category, criterion_id, criterion_name, weak_signal, prompt, strong_example, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (data.get("category", "*"), data.get("criterion_id", 3),
                 data.get("criterion_name", ""), data.get("weak_signal", ""),
                 data.get("prompt", ""), data.get("strong_example", ""), now, now),
            )
        return jsonify({"id": cur.lastrowid, "created": True}), 201
    except Exception as e:
        log.exception("Create pattern error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/patterns/notes/<int:pattern_id>", methods=["GET"])
def get_note_pattern(pattern_id: int):
    try:
        with _db() as con:
            row = con.execute(
                "SELECT * FROM note_patterns WHERE id=?", (pattern_id,)
            ).fetchone()
        if row is None:
            return jsonify({"error": "Pattern not found"}), 404
        return jsonify(dict(row))
    except Exception as e:
        log.exception("Get single pattern error")
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# Request / response logging
# ---------------------------------------------------------------------------
@app.before_request
def _log_request():
    log.debug("→ %s %s  args=%s  body=%d bytes",
              request.method, request.path,
              dict(request.args),
              request.content_length or 0)

@app.after_request
def _log_response(response):
    log.debug("← %s %s  status=%s  size=%s",
              request.method, request.path,
              response.status_code,
              response.content_length)
    return response


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    _init_db()

    host = os.getenv('HOST', '127.0.0.1')
    port = int(os.getenv('PORT', 8745))

    # Refuse to bind to a non-loopback address while a publicly-documented
    # default admin credential (Admin@CTQ2025) is active. This is a hard
    # stop, not a warning — that credential is in the README/CHANGELOG, so
    # exposing it beyond localhost is a critical exposure, not a footgun.
    if _DEV_DEFAULTS_ACTIVE and host not in ("127.0.0.1", "localhost", "::1"):
        log.error(
            "Refusing to start: ALLOW_DEV_DEFAULTS seeded a default admin "
            "account, but HOST=%s is not loopback. Set ADMIN_PASSWORD_HASH "
            "and USER_PASSWORD_HASH (see .env.example) and disable "
            "ALLOW_DEV_DEFAULTS before binding to a non-local address.",
            host,
        )
        raise SystemExit(1)

    banner = "=" * 58
    log.info(banner)
    log.info("  YK CTQ Audit Intelligence Platform v4.0")
    log.info(banner)
    log.info("  Serving from : %s", BASE_DIR)
    log.info("  Database     : %s", DB_PATH)
    log.info("  Log folder   : %s", LOG_DIR)
    log.info("  scikit-learn : %s", "available" if _SKLEARN else "not installed (clustering disabled)")
    log.info("  Open browser : http://%s:%s", host, port)
    log.info(banner)
    print(banner)
    print("  YK CTQ Audit Intelligence Platform v4.0")
    print(banner)
    print(f"  Serving from : {BASE_DIR}")
    print(f"  Database     : {DB_PATH}")
    print(f"  Log folder   : {LOG_DIR}")
    print(f"  scikit-learn : {'available' if _SKLEARN else 'not installed (clustering disabled)'}")
    print(f"  Open browser : http://{host}:{port}")
    print(banner)
    app.run(host=host, port=port, threaded=True, debug=False)
