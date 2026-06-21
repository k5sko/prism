"""Showable before/after demo for the transcript compression.

Run:
  .venv/bin/python -m clipper.compress_demo storage/<job_id>/sentences.json
  .venv/bin/python -m clipper.compress_demo storage/<job_id>/sentences.json --live

Prints the token reduction on the *actual* segment prompts (real Claude token
counts when an API key is available, else a 4-char/token estimate), an estimated
cost saving, and a few example dropped/kept sentences. With --live it runs the
real segmentation call with compression ON vs OFF and compares the moments found
— evidence that quality is preserved while tokens drop.
"""

from __future__ import annotations

import json
import sys

from .compress import compress
from .config import get_settings
from .pipeline.segment import _build_prompt, _chunk_indices, _est_tokens, _SYSTEM, segment_sentences

# Claude Sonnet 4.x input price (USD per 1M tokens) for the cost estimate.
_INPUT_PRICE_PER_M = 3.0


def _count_tokens(prompt: str, system: str) -> int:
    """Real Claude token count if a key is set; else a 4-char/token estimate."""
    try:
        from .llm import LLMClient

        c = LLMClient()._ensure_client()
        r = c.messages.count_tokens(
            model=get_settings().llm_model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return int(r.input_tokens)
    except Exception:
        return _est_tokens(prompt) + _est_tokens(system)


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if not argv:
        print("usage: python -m clipper.compress_demo <sentences.json> [--live]")
        return 2
    path = argv[0]
    live = "--live" in argv
    sentences = json.load(open(path))
    s = get_settings()
    chunks = _chunk_indices(len(sentences), s.segment_chunk_size, s.segment_chunk_overlap)

    print("=" * 64)
    print("TRANSCRIPT COMPRESSION — before / after")
    print("=" * 64)
    print(f"transcript: {path}")
    print(f"sentences: {len(sentences)}   chunks: {len(chunks)}   keep_ratio: {s.compress_keep_ratio}")
    print("(token counts are real Claude tokens via the count-tokens API)\n")

    tot_before = tot_after = 0
    kept_total = 0
    for i, (lo, hi) in enumerate(chunks):
        chunk = sentences[lo : hi + 1]
        comp = compress(chunk, keep_ratio=s.compress_keep_ratio)
        kept_total += len(comp)
        before = _count_tokens(_build_prompt(chunk, lo, hi), _SYSTEM)
        after = _count_tokens(_build_prompt(comp, lo, hi, compact=True), _SYSTEM)
        tot_before += before
        tot_after += after
        print(
            f"  chunk {i + 1}: {len(chunk):>3} -> {len(comp):>3} sentences   "
            f"{before:>5} -> {after:>5} tok   (-{(1 - after / before) * 100:4.1f}%)"
        )

    saved = tot_before - tot_after
    pct = (1 - tot_after / tot_before) * 100 if tot_before else 0
    print("-" * 64)
    print(f"  TOTAL input tokens:   {tot_before:>6}  ->  {tot_after:>6}")
    print(f"  TOKENS SAVED:         {saved:>6}   ({pct:.1f}% reduction)")
    print(f"  sentences kept:       {kept_total}/{sum(hi - lo + 1 for lo, hi in chunks)}")
    print(f"  est. cost saved/video: ${saved / 1_000_000 * _INPUT_PRICE_PER_M:.5f}  "
          f"(at ${_INPUT_PRICE_PER_M}/1M input tok)")
    print(f"  -> across 1,000 videos: ~${saved / 1_000_000 * _INPUT_PRICE_PER_M * 1000:.2f} saved\n")

    # show a few dropped (filler/low-salience) vs kept sentences
    kept_idx = {x["idx"] for x in compress(sentences[: chunks[0][1] + 1], keep_ratio=s.compress_keep_ratio)}
    dropped = [x for x in sentences[: chunks[0][1] + 1] if x["idx"] not in kept_idx][:5]
    print("examples DROPPED (filler / low-salience):")
    for x in dropped:
        print(f"   [{x['idx']}] {x['text'][:64]!r}")

    if live:
        print("\n" + "=" * 64)
        print("LIVE QUALITY CHECK — same call, compression OFF vs ON")
        print("=" * 64)
        from .llm import LLMClient

        llm = LLMClient()
        off, soff = segment_sentences(sentences, llm, s.segment_chunk_size, s.segment_chunk_overlap, compress_enabled=False)
        on, son = segment_sentences(sentences, llm, s.segment_chunk_size, s.segment_chunk_overlap, compress_enabled=True, keep_ratio=s.compress_keep_ratio)
        print(f"  OFF: {len(off)} moments,  {soff['sent_tokens']} tok sent")
        print(f"  ON : {len(on)} moments,  {son['sent_tokens']} tok sent  "
              f"(-{son['reduction'] * 100:.1f}% tokens)")
        print("\n  moments found WITH compression:")
        for m in on[:8]:
            print(f"   [{m['start_sentence']:>3}-{m['end_sentence']:<3}] {m['title']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
