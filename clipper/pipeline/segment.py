"""Phase 4 — Segment: numbered sentences -> candidate moments + labels (LLM).

The LLM works *only* in sentence-index space for *timing* — it returns
{start_sentence, end_sentence}, never timestamps. All time math is the
deterministic job of boundaries.py, so a bad model output can't produce a
mid-sentence cut. Sentences are sent in overlapping chunks so a moment spanning
a chunk seam isn't lost; exact cross-seam duplicates are dropped here and
>50%-overlap de-dup is left to the boundaries stage.

This pass *also* emits each moment's publishing metadata (title/hook/summary/
tags/score) in the same structured call — the model is already reading the
sentence text to segment it, so relabeling it in a separate per-clip pass just
re-sends the same transcript. boundaries.py carries these fields through
verbatim and label.py persists them; no second LLM read of the transcript.

Contract: [{"start_sentence": 12, "end_sentence": 18, "reason": "...",
            "title": "...", "hook": "...", "summary": "...",
            "tags": [...], "score": 0.0}]
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from ..config import get_settings
from ..llm import LLMClient
from ..storage import Storage, read_json, write_json

SENTENCES = "sentences.json"
ARTIFACT = "moments.json"

# Label fields the model produces per moment, alongside its sentence range.
_LABEL_KEYS = ("title", "hook", "summary", "tags", "score")

MOMENTS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "moments": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "start_sentence": {"type": "integer"},
                    "end_sentence": {"type": "integer"},
                    "reason": {"type": "string"},
                    "title": {"type": "string"},
                    "hook": {"type": "string"},
                    "summary": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "score": {"type": "number"},
                },
                "required": [
                    "start_sentence", "end_sentence", "reason",
                    "title", "hook", "summary", "tags", "score",
                ],
            },
        }
    },
    "required": ["moments"],
}

_SYSTEM = (
    "You are an expert short-form video editor. In one pass you both find "
    "self-contained moments in a transcript — spans that present one complete "
    "idea and make full sense on their own, with no dependency on surrounding "
    "context — and write each one's publishing metadata. You never start a "
    "moment mid-thought or on a dangling reference. Titles are concise and "
    "specific (no clickbait), hooks are a single scroll-stopping line, and "
    "summaries are one or two sentences."
)


def _chunk_indices(n: int, size: int, overlap: int) -> List[Tuple[int, int]]:
    if n <= 0:
        return []
    if size <= 0:
        size = n
    step = max(1, size - overlap)
    windows: List[Tuple[int, int]] = []
    start = 0
    while start < n:
        hi = min(start + size - 1, n - 1)
        windows.append((start, hi))
        if hi == n - 1:
            break
        start += step
    return windows


def _build_prompt(sentences: List[dict], lo: int, hi: int) -> str:
    lines = [
        "Below are numbered transcript sentences with their [start–end] times in "
        "seconds. Identify the self-contained moments worth clipping and write "
        "each one's publishing metadata.",
        "",
        "Boundary rules:",
        f"- Use absolute sentence indices in the range {lo}..{hi} (inclusive).",
        "- Each moment is one complete idea that stands alone without outside context.",
        "- A moment must not begin on a dangling reference (e.g. 'so that's why', "
        "'and this means') — start where the idea actually starts.",
        "- Prefer moments that run roughly 15–90 seconds (use the timestamps).",
        "- end_sentence >= start_sentence. Moments may not overlap each other.",
        "",
        "For each moment also produce:",
        "- reason: a short note on why the span stands alone (also used to rank it).",
        "- title: a specific, concise title (no clickbait).",
        "- hook: one line that makes someone stop scrolling.",
        "- summary: 1–2 sentences on what the moment covers.",
        "- tags: 3–6 lowercase topical tags.",
        "- score: 0–1, standalone clarity + hook strength.",
        "",
        "Sentences:",
    ]
    for s in sentences:
        lines.append(f"[{s['idx']}] ({s['start']:.1f}-{s['end']:.1f}s) {s['text']}")
    return "\n".join(lines)


def _clamp_score(value) -> float:
    try:
        return round(max(0.0, min(1.0, float(value))), 3)
    except (TypeError, ValueError):
        return 0.0


def _labels(m: dict) -> dict:
    return {
        "title": str(m.get("title", "")).strip(),
        "hook": str(m.get("hook", "")).strip(),
        "summary": str(m.get("summary", "")).strip(),
        "tags": [str(t) for t in (m.get("tags") or [])],
        "score": _clamp_score(m.get("score")),
    }


def _validate(raw: List[dict], n: int) -> List[dict]:
    cleaned = []
    seen = set()
    for m in raw:
        try:
            start = int(m["start_sentence"])
            end = int(m["end_sentence"])
        except (KeyError, TypeError, ValueError):
            continue
        start = max(0, min(start, n - 1))
        end = max(0, min(end, n - 1))
        if start > end:
            continue
        key = (start, end)
        if key in seen:  # exact cross-seam duplicate (first occurrence's labels win)
            continue
        seen.add(key)
        cleaned.append(
            {
                "start_sentence": start,
                "end_sentence": end,
                "reason": str(m.get("reason", "")).strip(),
                **_labels(m),
            }
        )
    cleaned.sort(key=lambda x: (x["start_sentence"], x["end_sentence"]))
    return cleaned


def segment_sentences(
    sentences: List[dict],
    llm: LLMClient,
    chunk_size: int,
    overlap: int,
) -> List[dict]:
    n = len(sentences)
    raw: List[dict] = []
    for lo, hi in _chunk_indices(n, chunk_size, overlap):
        prompt = _build_prompt(sentences[lo : hi + 1], lo, hi)
        result = llm.complete_json(prompt, MOMENTS_SCHEMA, system=_SYSTEM)
        for m in (result or {}).get("moments", []):
            raw.append(m)
    return _validate(raw, n)


def run(
    job_id: str,
    storage: Storage,
    llm: Optional[LLMClient] = None,
    *,
    force: bool = False,
) -> List[dict]:
    if storage.exists(job_id, ARTIFACT) and not force:
        return read_json(storage, job_id, ARTIFACT)
    if not storage.exists(job_id, SENTENCES):
        raise FileNotFoundError(
            f"{SENTENCES} missing for job {job_id!r}; run sentences first"
        )
    sentences = read_json(storage, job_id, SENTENCES)
    llm = llm or LLMClient()
    settings = get_settings()
    moments = segment_sentences(
        sentences, llm, settings.segment_chunk_size, settings.segment_chunk_overlap
    )
    write_json(storage, moments, job_id, ARTIFACT)
    return moments
