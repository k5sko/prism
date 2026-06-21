"""Recently-watched clips -> a tiny comprehension quiz (LLM).

The feed pops a 1-2 question multiple-choice check every few reels. Questions
test the key idea of the clips the learner just watched (weighted to the most
recent). We never fabricate a quiz: if the model returns nothing usable we
return [] and the feed just skips the check.
"""

from __future__ import annotations

from typing import List, Optional

from .llm import LLMClient

_QUIZ_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "answer_index": {"type": "integer"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "options", "answer_index", "explanation"],
            },
        }
    },
    "required": ["questions"],
}

_SYSTEM = (
    "You write quick comprehension checks for short educational video clips a "
    "learner just watched. Each question is clear, answerable from the clip's "
    "idea alone, has exactly one correct option and plausible (not trick) "
    "distractors, and stays concrete."
)


def _context(clips: List[dict]) -> str:
    lines = []
    for i, c in enumerate(clips):
        title = str(c.get("title") or "").strip()
        summary = str(c.get("summary") or "").strip()
        if not (title or summary):
            continue
        lines.append(f"{i + 1}. {title}" + (f" — {summary}" if summary else ""))
    return "\n".join(lines)


def generate_quiz(clips: List[dict], llm: Optional[LLMClient] = None, n_questions: int = 2) -> List[dict]:
    """Return up to `n_questions` validated MCQs, or [] if nothing usable."""
    ctx = _context(clips or [])
    if not ctx:
        return []
    llm = llm or LLMClient()
    n = max(1, min(int(n_questions or 2), 3))
    prompt = (
        f"A learner just watched these short clips (most recent first):\n{ctx}\n\n"
        f"Write {n} multiple-choice question(s) checking they understood the key "
        "idea, weighted toward the MOST RECENT clip. Each question: a concise "
        "prompt, exactly 3 or 4 options, one correct answer (give its 0-based "
        "index in answer_index), and a one-sentence explanation of why it's right."
    )
    out = llm.complete_json(prompt, _QUIZ_SCHEMA, system=_SYSTEM) or {}

    cleaned: List[dict] = []
    for q in out.get("questions") or []:
        question = str(q.get("question") or "").strip()
        options = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()][:4]
        if not question or len(options) < 2:
            continue
        try:
            answer_index = int(q.get("answer_index"))
        except (TypeError, ValueError):
            answer_index = 0
        answer_index = max(0, min(answer_index, len(options) - 1))
        cleaned.append(
            {
                "question": question,
                "options": options,
                "answer_index": answer_index,
                "explanation": str(q.get("explanation") or "").strip(),
            }
        )
        if len(cleaned) >= n:
            break
    return cleaned
