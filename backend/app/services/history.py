"""Session-scoped, in-memory analysis history.

Design note: history is per-session and held in process memory only. It is
documented as ephemeral; restarting the backend or closing a session clears it.
This lets the Dashboard honestly display "Recent analyses" without pretending
there is a patient database.
"""
import threading
import time
import uuid

from ..config import MAX_HISTORY_PER_SESSION
from ..schemas import HistoryEntry

_store: dict[str, list[HistoryEntry]] = {}
_lock = threading.Lock()


def history_for(session_id: str):
    with _lock:
        docs = list(_store.get(session_id, []))
    return list(reversed(docs))            # newest first


def add_entry(session_id: str, entry: dict):
    e = HistoryEntry(**{
        "id": uuid.uuid4().hex[:12],
        "created_at": _now(),
        **entry,
    })
    with _lock:
        lst = _store.setdefault(session_id, [])
        lst.append(e)
        if len(lst) > MAX_HISTORY_PER_SESSION:
            del lst[0:len(lst) - MAX_HISTORY_PER_SESSION]
    return e


def clear(session_id: str) -> int:
    with _lock:
        n = len(_store.get(session_id, []))
        _store.pop(session_id, None)
    return n


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def session_analyses_count(session_id: str) -> int:
    with _lock:
        return len(_store.get(session_id, []))
