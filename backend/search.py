from rapidfuzz import fuzz

THRESHOLD = 70  # minimum score (0-100) to count as a match


def find_matches(query: str, segments: list[dict]) -> list[dict]:
    """Fuzzy search query against transcript segments.
    Returns a list of matching timestamp ranges: [{ start, end }, ...]"""
    query_lower = query.lower()
    results = []

    for seg in segments:
        score = fuzz.partial_ratio(query_lower, seg["text"].lower())
        if score >= THRESHOLD:
            results.append({"start": seg["start"], "end": seg["end"], "text": seg["text"]})

    return results
