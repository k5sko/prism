"""Topic finder: vague → clarification, specific → picks a found video.
Uses a fake LLM and an injected search function (no network)."""

from __future__ import annotations

from clipper.finder import find_video, find_videos


class FakeLLM:
    """Returns specificity / single-pick / ranking, based on the schema passed."""

    def __init__(self, *, specific, best_index=0, ranking=(0, 1)):
        self.specific = specific
        self.best_index = best_index
        self.ranking = list(ranking)

    def complete_json(self, prompt, schema, *, system=None, max_tokens=None):
        props = schema.get("properties", {})
        if "specific" in props:
            if self.specific:
                return {"specific": True, "search_query": "chain rule",
                        "message": "", "suggestions": []}
            return {"specific": False, "search_query": "",
                    "message": "Math is broad — pick a topic.",
                    "suggestions": ["the chain rule", "integration by parts"]}
        if "ranking" in props:
            return {"ranking": self.ranking, "reason": "ranked"}
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


def test_find_videos_returns_top_two():
    res = find_videos("the chain rule", FakeLLM(specific=True, ranking=[0, 1]),
                      count=2, channels=_CHANNELS, search_fn=_fake_search)
    assert res["status"] == "found"
    assert [v["title"] for v in res["videos"]] == ["Chain Rule Explained", "Product Rule"]


def test_find_videos_respects_count_and_ranking_order():
    res = find_videos("the chain rule", FakeLLM(specific=True, ranking=[1, 0]),
                      count=1, channels=_CHANNELS, search_fn=_fake_search)
    assert res["status"] == "found"
    assert [v["title"] for v in res["videos"]] == ["Product Rule"]  # rank 1 first, capped at 1


def test_find_videos_vague_clarifies():
    res = find_videos("teach me math", FakeLLM(specific=False),
                      count=2, channels=_CHANNELS, search_fn=_fake_search)
    assert res["status"] == "needs_clarification"


def test_find_videos_is_channel_diverse():
    # ranking favors Alpha for the top two slots, but with count=2 we should still
    # get one Alpha + one Beta (best from each channel).
    def two_channels(query, channel, limit=6):
        return [
            {"id": "a" * 11, "title": "A1", "url": "u1", "duration": 600, "channel": "Alpha"},
            {"id": "b" * 11, "title": "A2", "url": "u2", "duration": 500, "channel": "Alpha"},
            {"id": "c" * 11, "title": "B1", "url": "u3", "duration": 400, "channel": "Beta"},
        ]

    res = find_videos("x", FakeLLM(specific=True, ranking=[0, 1, 2]), count=2,
                      channels=_CHANNELS, search_fn=two_channels)
    assert res["status"] == "found"
    assert {v["channel"] for v in res["videos"]} == {"Alpha", "Beta"}
