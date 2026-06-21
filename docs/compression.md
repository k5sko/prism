# Transcript Compression — token reduction for the segmentation LLM call

> Our entry for **The Token Company** track: a compression technique that reduces
> the information sent to the LLM while preserving the context needed for
> high-quality output — with showable, reproducible results.

## What we optimised

Our clipping pipeline's **single biggest (and only) LLM token sink** is the
`segment` call: it reads a video's **full transcript** and returns the
self-contained "moments" worth clipping (plus each clip's title/hook/summary in
the same pass). For a typical video that's ~5,000–9,000 input tokens per video,
sent in ~120-sentence chunks. Most of it is **filler and structural overhead**,
not signal.

## How we did it — extractive, index-preserving compression

The call has a hard contract: the model returns moments as **absolute
sentence-index ranges** (`{start_sentence, end_sentence}`), and all downstream
timing is computed from those indices. So we **cannot** mangle or renumber
sentences. We compress in two layers, both of which keep that contract intact:

1. **Extractive sentence selection** (`clipper/compress.py`). We keep whole
   sentences **verbatim** (with their original index + timestamp) and drop only
   low-value ones — spoken filler, backchannels ("okay", "so", "right"),
   transcript fragments ("In", "And"), and low-salience sentences scored by a
   **Luhn-style** density of recurring content words. A moment range can still
   span a dropped interior sentence, which `boundaries.py` fills back in from the
   *full* transcript. We also strip in-sentence disfluencies ("um", "you know",
   immediate repeats).
2. **Structural-metadata compaction** (`clipper/pipeline/segment.py`,
   `_build_prompt(..., compact=True)`). Each line went from
   `[12] (15.4-23.4s) text` to `12|15| text` — index + integer start-second only;
   the model infers a sentence's end from the next line. Nearly half the original
   prompt was per-sentence metadata, so this alone is a large win.

**Why extractive over token-pruning (e.g. LLMLingua):** for an
extraction/segmentation task, dropping whole low-information *sentences* preserves
the index/timestamp structure the model depends on, and removing noise tends to
*help* moment detection. (Research consensus, e.g. independent multi-dataset
benchmarks, shows extractive ≥ token-level pruning at the 2–4× ratios that are
safe for extraction tasks; LongLLMLingua even reports +21.4% on NaturalQuestions
at ~4× fewer tokens.) We stay deliberately light to keep quality at parity.

## Results (real Claude token counts)

Measured on a real transcript (3Blue1Brown chain-rule video, 272 sentences) via
Anthropic's token-counting API:

| | Tokens in | Tokens sent | Reduction |
|---|---|---|---|
| **Segment prompts (per video)** | 8,835 | 5,248 | **40.6%** |

**Quality held:** a controlled A/B (same call, compression **off vs on**) found
the **same 9 moments**, with coherent titles in both — token cost dropped, output
did not. Light compression (the safe 2–4× regime) is exactly where reduction is
free of quality loss.

## How to show it

- **In-app badge** (Learn screen): a live "**N tokens saved · transcripts X%
  smaller**" pill, aggregated across all processed videos via `GET /api/stats`.
  Every video writes a `compression.json` record; the badge sums them.
- **Standalone demo** (before/after + live quality proof):
  ```
  .venv/bin/python -m clipper.compress_demo storage/<job_id>/sentences.json --live
  ```
  Prints per-chunk token reduction (real Claude tokens), estimated cost saved,
  example dropped sentences, and the off-vs-on moment comparison.
- **Raw numbers:** `GET /api/stats` →
  `{ jobs, original_tokens, sent_tokens, saved_tokens, reduction, est_cost_saved_usd }`.

## Where it lives

- `clipper/compress.py` — the extractive compressor (filler strip + salience prune)
- `clipper/pipeline/segment.py` — compact prompt format + integration + per-job stats
- `clipper/compress_demo.py` — the showable before/after + live A/B
- `clipper/api.py` — `GET /api/stats`
- config: `compress_segment` (on/off), `compress_keep_ratio` (default 0.6)
