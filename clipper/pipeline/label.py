"""Phase 7 — Persist: write the labeled clips to the DB + clips.json.

Labels ({title, hook, summary, tags[], score}) are produced upstream in the
segment pass and carried verbatim through boundaries, so this stage makes no LLM
calls — it normalizes the carried fields, writes one DB row per clip
(status="ready"), and emits clips.json as the stage's final artifact. `score`
(0–1) reflects standalone clarity + hook strength; downstream stages
(compression/filter, recommendation, RAG) read these records straight from the
DB.
"""

from __future__ import annotations

import json
from typing import List, Optional

from ..db import Clip, ClipStatus, init_db, session_scope
from ..storage import Storage, read_json, write_json

BOUNDARIES = "boundaries.json"
VIDEO = "video.mp4"
ARTIFACT = "clips.json"


def _normalize_labels(clip: dict) -> dict:
    """Final, defensive coercion of the labels carried from the segment pass."""
    try:
        score = max(0.0, min(1.0, float(clip.get("score", 0.0))))
    except (TypeError, ValueError):
        score = 0.0
    return {
        "title": str(clip.get("title") or "").strip(),
        "hook": str(clip.get("hook") or "").strip(),
        "summary": str(clip.get("summary") or "").strip(),
        "tags": [str(t) for t in (clip.get("tags") or [])],
        "score": round(score, 3),
    }


def run(
    job_id: str,
    storage: Storage,
    llm=None,  # accepted for orchestrator signature compatibility; unused — labels
    *,         # now come from the segment pass, not a per-clip LLM call.
    force: bool = False,
) -> List[dict]:
    if storage.exists(job_id, ARTIFACT) and not force:
        return read_json(storage, job_id, ARTIFACT)
    if not storage.exists(job_id, BOUNDARIES):
        raise FileNotFoundError(
            f"{BOUNDARIES} missing for job {job_id!r}; run boundaries first"
        )

    clips = read_json(storage, job_id, BOUNDARIES)
    # Virtual clips: every clip references the one source video + start/end.
    source_video = storage.path(job_id, VIDEO)

    records: List[dict] = []
    for c in clips:
        meta = _normalize_labels(c)
        records.append(
            {
                # globally-unique id (the on-disk filename stays the per-job
                # short id; clips are served by file_path, not id)
                "id": f"{job_id}_{c['id']}",
                "job_id": job_id,
                "start": c["start"],
                "end": c["end"],
                "duration": c["duration"],
                "title": meta["title"],
                "hook": meta["hook"],
                "summary": meta["summary"],
                "tags": meta["tags"],
                "score": meta["score"],
                "file_path": source_video,  # source video; clip is start→end of it
                "status": ClipStatus.READY,
            }
        )

    init_db()
    with session_scope() as s:
        for r in records:
            s.merge(
                Clip(
                    id=r["id"],
                    job_id=job_id,
                    start=r["start"],
                    end=r["end"],
                    duration=r["duration"],
                    title=r["title"],
                    hook=r["hook"],
                    summary=r["summary"],
                    tags=json.dumps(r["tags"]),
                    score=r["score"],
                    file_path=r["file_path"],
                    status=ClipStatus.READY,
                )
            )
        s.commit()

    write_json(storage, records, job_id, ARTIFACT)
    return records
