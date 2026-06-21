"""Topic finder: vague → clarification, specific → picks a found video.
Uses a fake LLM and an injected search function (no network)."""

from __future__ import annotations

from clipper.finder import find_video


class FakeLLM:
    """Returns specificity, then pick, based on which schema is passed in."""

    def __init__(self, *, specific, best_index=0):
        self.specific = specific
        self.best_index = best_index

    def complete_json(self, prompt, schema, *, system=None, max_tokens=None):
        props = schema.get("properties", {})
        if "specific" in props:
            if self.specific:
                return {"specific": True, "search_query": "chain rule",
                        "message": "", "suggestions": []}
            return {"specific": False, "search_query": "",
                    "message": "Math is broad — pick a topic.",
                    "suggestions": ["the chain rule", "integration by parts"]}
        return {"best_index": self.best_index, "reason": "best match"}


_CHANNELS = [{"name": "Test Channel", "url": "https://youtube.com/@x", "subjects": ["math"]}]


def _fake_search(query, channel, limit=6):
    return [
        {"id": "a" * 11, "title": "Chain Rule Explained", "url": "https://youtu.be/a",
         "duration": 600, "channel": "Test Channel"},
        {"id": "b" * 11, "title": "Product Rule", "url": "https://youtu.be/b",
         "duration": 500, "channel": "Test Channel"},
    ]


def test_vague_query_asks_for_clarification():
    res = find_video("teach me math", FakeLLM(specific=False), _CHANNELS, _fake_search)
    assert res["status"] == "needs_clarification"
    assert res["suggestions"]


def test_specific_query_finds_video():
    res = find_video("the chain rule", FakeLLM(specific=True, best_index=0), _CHANNELS, _fake_search)
    assert res["status"] == "found"
    assert res["video"]["title"] == "Chain Rule Explained"


def test_no_match_returns_not_found():
    res = find_video("the chain rule", FakeLLM(specific=True, best_index=-1), _CHANNELS, _fake_search)
    assert res["status"] == "not_found"


def test_empty_search_returns_not_found():
    res = find_video("the chain rule", FakeLLM(specific=True), _CHANNELS,
                     lambda q, c, limit=6: [])
    assert res["status"] == "not_found"
