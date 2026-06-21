"""Transcript compression for the segmentation LLM call (the pipeline's single
biggest token sink — segment+label run in one pass over the full transcript).

Approach: **extractive, index-preserving**. We keep whole sentences verbatim
(with their original idx + start/end timestamps) and (1) strip spoken-filler
tokens inside them and (2) drop low-salience / backchannel sentences. The LLM
still works in absolute sentence-index space, so the {start_sentence,
end_sentence} contract and all downstream timing are unchanged — a moment range
simply spans any dropped interior sentences, which boundaries.py fills back in
from the *full* transcript.

Why extractive (keep sentences verbatim) instead of token-pruning (LLMLingua):
for an extraction/segmentation task, dropping whole low-information sentences
preserves the index+timestamp structure the model relies on, and removing noise
tends to *help* moment detection rather than hurt it. Research consensus is that
extractive >= token-level pruning at the 2-4x ratios that are safe for
extraction tasks. We stay deliberately light (~0.6 keep ratio + filler strip ->
~2x token reduction) — the regime shown to cut cost with negligible quality loss.
"""

from __future__ import annotations

import re
from typing import List

# Spoken-filler / disfluency patterns — conservative, only unambiguous filler.
_FILLERS = re.compile(
    r"\b(?:um+|uh+|erm?|ah+|hmm+|you know|i mean|kind of|sort of|"
    r"basically|actually|literally|honestly|like i said|so to speak|"
    r"and so on|and stuff|or whatever|right\?)\b",
    re.IGNORECASE,
)
_REPEAT = re.compile(r"\b(\w+)(\s+\1\b)+", re.IGNORECASE)  # immediate word repeats
_WS = re.compile(r"\s{2,}")

# Sentences that are pure backchannel / non-content — dropped outright.
_BACKCHANNEL = re.compile(
    r"^\s*(?:okay|ok|alright|all right|right|yeah|yep|so|now|well|"
    r"um+|uh+|music|applause|let'?s see|let me see|here we go|"
    r"cool|great|awesome|got it|moving on)[\s.,!?]*$",
    re.IGNORECASE,
)

_STOP = set(
    "the a an of to in on for and or is are be was were it this that as by from "
    "with at we you i he she they them his her its our your my me but so if then "
    "than too very just can will would could should do does did have has had not "
    "no yes here there what which who when how why also into out up down over "
    "under about off only more most some any all each".split()
)


def strip_fillers(text: str) -> str:
    t = _FILLERS.sub("", text)
    t = _REPEAT.sub(r"\1", t)
    t = _WS.sub(" ", t)
    t = re.sub(r"\s+([,.!?])", r"\1", t)  # tidy space before punctuation
    t = re.sub(r"^[,\s]+", "", t).strip()
    return t or text  # never blank a sentence out


def _content_words(text: str) -> List[str]:
    return [w for w in re.findall(r"[a-z0-9']+", text.lower()) if len(w) > 2 and w not in _STOP]


def _salience(sentences: List[dict]) -> List[float]:
    """Luhn-style: a sentence scores by its density of 'significant' words —
    content words that recur in the chunk (i.e. the topic vocabulary)."""
    freq: dict = {}
    for s in sentences:
        for w in set(_content_words(s["text"])):
            freq[w] = freq.get(w, 0) + 1
    significant = {w for w, c in freq.items() if c >= 2}
    scores = []
    for s in sentences:
        words = _content_words(s["text"])
        if not words:
            scores.append(0.0)
            continue
        hits = sum(1 for w in words if w in significant)
        distinct = len(set(words))
        scores.append((hits + 0.5 * distinct) / (len(words) ** 0.5))  # length-normalized
    return scores


def compress(sentences: List[dict], keep_ratio: float = 0.6, min_keep: int = 8) -> List[dict]:
    """Return a filler-stripped, salience-pruned subset of `sentences`,
    preserving each kept sentence's original idx/start/end fields and order."""
    n = len(sentences)
    if n <= min_keep:
        return [{**s, "text": strip_fillers(s["text"])} for s in sentences]

    scores = _salience(sentences)
    not_backchannel = [not _BACKCHANNEL.match(str(s["text"]).strip()) for s in sentences]

    target = max(min_keep, int(round(n * keep_ratio)))
    ranked = sorted(range(n), key=lambda i: scores[i], reverse=True)
    keep = set()
    for i in ranked:
        if not_backchannel[i]:
            keep.add(i)
        if len(keep) >= target:
            break
    keep.add(0)
    keep.add(n - 1)  # keep chunk edges for boundary context

    return [{**sentences[i], "text": strip_fillers(sentences[i]["text"])} for i in sorted(keep)]
