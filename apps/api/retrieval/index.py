"""
Curated Guidance Retrieval Index.
Implements pure-Python BM25 and keyword search over the 30 authoritative air guidance chunks.
Deterministic, fast, zero framework dependency, runs completely offline.
"""

import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path

CORPUS_PATH = Path(
    os.environ.get(
        "CORPUS_PATH",
        Path(__file__).resolve().parent.parent / "data" / "corpus" / "air_guidance_chunks.json",
    )
)

SYNONYMS: dict[str, list[str]] = {
    "plant": ["plants", "snake", "areca", "palm", "money", "flora"],
    "gur": ["jaggery", "gur", "sweet", "detox"],
    "jaggery": ["gur", "jaggery", "sweet", "detox"],
    "steam": ["steam", "inhalation", "vapour", "vapor"],
    "mask": ["mask", "masks", "n95", "ffp2", "cloth", "surgical", "respirator"],
    "purifier": ["purifier", "cadr", "hepa", "filter", "filters", "cleaner"],
    "kid": ["children", "child", "infant", "pediatric", "kids"],
    "child": ["children", "child", "infant", "pediatric", "kids"],
    "elderly": ["senior", "elderly", "grandparent", "seniors", "aged", "cardiac"],
    "exercise": ["walk", "walking", "jogging", "exercise", "workout", "running"],
    "window": ["windows", "ventilation", "airing", "opening", "inversion"],
}


@dataclass
class CorpusChunk:
    id: str
    title: str
    publisher: str
    url: str
    retrieval_date: str
    text: str
    tags: list[str]


def tokenize(text: str) -> list[str]:
    """Tokenize and normalize text into alphanumeric words."""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = clean.split()
    # Expand synonyms
    expanded = list(tokens)
    for t in tokens:
        if t in SYNONYMS:
            expanded.extend(SYNONYMS[t])
    return expanded


class BM25Index:
    def __init__(self, corpus_path: Path = CORPUS_PATH):
        self.corpus_path = corpus_path
        self.chunks: list[CorpusChunk] = []
        self.doc_tokens: list[list[str]] = []
        self.doc_lengths: list[int] = []
        self.avg_doc_len: float = 0.0
        self.df: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.k1 = 1.5
        self.b = 0.75
        self.load_corpus()

    def load_corpus(self):
        if not self.corpus_path.exists():
            candidates = [
                Path(__file__).resolve().parent.parent
                / "data"
                / "corpus"
                / "air_guidance_chunks.json",
                Path("apps/api/data/corpus/air_guidance_chunks.json"),
                Path("corpus/air_guidance_chunks.json"),
            ]
            for cand in candidates:
                if cand.exists():
                    self.corpus_path = cand
                    break
            else:
                raise FileNotFoundError(f"Corpus file not found at {self.corpus_path}")

        with open(self.corpus_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.chunks = []
        self.doc_tokens = []
        self.doc_lengths = []
        total_tokens = 0

        for item in data:
            chunk = CorpusChunk(
                id=item["id"],
                title=item["title"],
                publisher=item["publisher"],
                url=item["url"],
                retrieval_date=item["retrieval_date"],
                text=item["text"],
                tags=item.get("tags", []),
            )
            self.chunks.append(chunk)

            # Combined content for indexing: title + tags + text
            full_str = f"{chunk.title} {' '.join(chunk.tags)} {chunk.text}"
            tokens = tokenize(full_str)
            self.doc_tokens.append(tokens)
            length = len(tokens)
            self.doc_lengths.append(length)
            total_tokens += length

        n_docs = len(self.chunks)
        self.avg_doc_len = total_tokens / n_docs if n_docs > 0 else 1.0

        # Compute document frequency (DF)
        self.df = {}
        for tokens in self.doc_tokens:
            unique_terms: set[str] = set(tokens)
            for term in unique_terms:
                self.df[term] = self.df.get(term, 0) + 1

        # Compute Robertson-Spärck Jones IDF
        self.idf = {}
        for term, freq in self.df.items():
            self.idf[term] = math.log((n_docs - freq + 0.5) / (freq + 0.5) + 1.0)

    def search(self, query: str, top_k: int = 3) -> list[tuple[CorpusChunk, float]]:
        query_tokens = tokenize(query)
        if not query_tokens:
            return [(c, 1.0) for c in self.chunks[:top_k]]

        scores: list[float] = [0.0] * len(self.chunks)

        for i, tokens in enumerate(self.doc_tokens):
            score = 0.0
            doc_len = self.doc_lengths[i]
            # Term counts in document
            term_counts: dict[str, int] = {}
            for t in tokens:
                term_counts[t] = term_counts.get(t, 0) + 1

            for q_term in query_tokens:
                if q_term not in term_counts:
                    continue
                tf = term_counts[q_term]
                idf = self.idf.get(q_term, 0.5)
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                score += idf * (numerator / denominator)

            # Boost if query tokens match chunk id directly
            for q_term in query_tokens:
                if q_term in self.chunks[i].id:
                    score += 2.0

            scores[i] = score

        # Rank documents
        ranked_indices = sorted(range(len(scores)), key=lambda k: scores[k], reverse=True)
        results = []
        for idx in ranked_indices[:top_k]:
            if scores[idx] > 0.0 or len(results) == 0:
                results.append((self.chunks[idx], round(scores[idx], 3)))

        return results


# Singleton index instance
_index: BM25Index | None = None


def get_retrieval_index() -> BM25Index:
    global _index
    if _index is None:
        _index = BM25Index()
    return _index


def lookup_guidance(query: str, top_k: int = 3) -> list[dict]:
    """
    Retrieves top_k authoritative chunks matching user query.
    Every returned item explicitly retains source id, title, publisher, and verified citation URL.
    """
    index = get_retrieval_index()
    results = index.search(query, top_k=top_k)
    return [
        {
            "source_id": chunk.id,
            "title": chunk.title,
            "publisher": chunk.publisher,
            "url": chunk.url,
            "text": chunk.text,
            "relevance_score": score,
        }
        for chunk, score in results
    ]
