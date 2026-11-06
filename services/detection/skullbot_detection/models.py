"""Real optional model inference. Missing dependencies/models never become fabricated scores."""
from functools import lru_cache
import math
import re
import statistics
import threading
from .preprocess import tokens, segments, exclusion_ranges, language

MODEL_LOCK = threading.RLock()


def chunks(text, max_words=100):
    ts = tokens(text)
    return [{"start": ts[i].start, "end": ts[min(i + max_words, len(ts)) - 1].end,
             "text": text[ts[i].start:ts[min(i + max_words, len(ts)) - 1].end]}
            for i in range(0, len(ts), max_words)]


@lru_cache(maxsize=2)
def embedding_model(name, revision):
    import torch
    from .config import settings
    torch.set_num_threads(settings().inference_threads)
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(name, revision=revision, trust_remote_code=False, device="cpu", local_files_only=True, model_kwargs={"use_safetensors": True})


@lru_cache(maxsize=2)
def classifier(name, revision):
    import torch
    from .config import settings
    torch.set_num_threads(settings().inference_threads)
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    tokenizer = AutoTokenizer.from_pretrained(name, revision=revision, trust_remote_code=False, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(name, revision=revision, trust_remote_code=False, use_safetensors=True, local_files_only=True)
    model.eval()
    return tokenizer, model


def semantic(text, sources, repo, tenant, cfg):
    if not cfg.embedding_model:
        return {"status": "unavailable", "reason": "No embedding model configured.", "matches": []}
    try:
        with MODEL_LOCK:
            model = embedding_model(cfg.embedding_model, cfg.embedding_revision)
            query = chunks(text)[:200]
            if not query:
                return {"status": "insufficient_text", "matches": []}
            q = model.encode([c["text"] for c in query], normalize_embeddings=True)
            matches = []
            key = cfg.embedding_model + "@" + cfg.embedding_revision
            for source in sources:
                passages = chunks(source["text"])[:200]
                if not passages:
                    continue
                cached = repo.vectors(tenant, source["id"], key) if not source["id"].startswith("supplied-") else None
                if cached is None:
                    cached = model.encode([c["text"] for c in passages], normalize_embeddings=True).tolist()
                    if not source["id"].startswith("supplied-"):
                        repo.vectors(tenant, source["id"], key, cached)
                import numpy as np
                scores = q @ np.asarray(cached).T
                for i, row in enumerate(scores):
                    j = int(row.argmax())
                    value = float(row[j])
                    if value >= cfg.semantic_threshold:
                        matches.append({"start": query[i]["start"], "end": query[i]["end"],
                                        "source_start": passages[j]["start"], "source_end": passages[j]["end"],
                                        "source_id": source["id"], "source_title": source["title"], "source_url": source.get("url", ""), "cosine": round(value, 4), "kind": "semantic_candidate"})
            return {"status": "completed", "model": key, "threshold": cfg.semantic_threshold,
                    "matches": sorted(matches, key=lambda m: -m["cosine"])[:200],
                    "coverage": "First 200 chunks of 100 words per document; exhaustive cosine search over bounded tenant corpus.",
                    "limitations": ["Semantic similarity suggests related meaning; it does not prove borrowing and is not added to the exact-match percentage."]}
    except Exception as exc:
        return {"status": "unavailable", "reason": "Embedding model failed to load or run: " + type(exc).__name__, "matches": []}


def style_features(text):
    ts = tokens(text)
    lengths = [len(tokens(s["text"])) for s in segments(text)]
    mean = statistics.mean(lengths) if lengths else 0
    return {"words": len(ts), "type_token_ratio": len(set(t.value for t in ts)) / max(1, len(ts)),
            "mean_sentence_words": mean, "sentence_length_cv": statistics.pstdev(lengths) / mean if mean else 0,
            "mean_token_characters": sum(len(t.value) for t in ts) / max(1, len(ts)),
            "label": "Descriptive features, not AI probabilities"}


def perplexity(text, cfg):
    if not cfg.reference_lm:
        return {"status": "unavailable", "reason": "No reference language model configured."}
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        with MODEL_LOCK:
            tokenizer, model = reference_lm(cfg.reference_lm, cfg.reference_lm_revision)
            encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
            with torch.inference_mode():
                loss = model(**encoded, labels=encoded["input_ids"]).loss.item()
            return {"status": "completed", "value": math.exp(min(loss, 30)), "model": cfg.reference_lm,
                    "coverage": "First 512 model tokens only; not an AI score."}
    except Exception as exc:
        return {"status": "unavailable", "reason": type(exc).__name__}


@lru_cache(maxsize=1)
def reference_lm(name, revision):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    model = AutoModelForCausalLM.from_pretrained(name, revision=revision, trust_remote_code=False, use_safetensors=True, local_files_only=True)
    model.eval()
    return AutoTokenizer.from_pretrained(name, revision=revision, trust_remote_code=False, local_files_only=True), model


def ai_detection(text, cfg):
    exclusions = exclusion_ranges(text, False, True, prose_only=True)
    sentences = [s for s in segments(text) if not any(s["start"] < b and s["end"] > a for a, b in exclusions) and len(tokens(s["text"])) >= 5]
    prose = " ".join(s["text"] for s in sentences)
    features = style_features(prose)
    base = {"features": features, "language": language(prose), "percentage": None, "sentences": [],
            "calibration": "Uncalibrated research baseline; no measured modern-LLM false-positive rate.",
            "limitations": ["Not evidence of misconduct; human review is required.", "No claim of detecting AI paraphrasing, current models, or multilingual writing without evaluation.", "Sentence values project overlapping-window model outputs; they are not independently calibrated sentence probabilities."]}
    if features["words"] < cfg.ai_min_words:
        return base | {"status": "insufficient_text", "reason": f"At least {cfg.ai_min_words} eligible prose words are required."}
    if base["language"]["code"] != "en":
        return base | {"status": "unsupported_language", "reason": "The baseline supports English only."}
    if not cfg.ai_model:
        return base | {"status": "unavailable", "reason": "No trained classifier configured. Style features are never converted into AI percentages."}
    try:
        import torch
        with MODEL_LOCK:
            tokenizer, model = classifier(cfg.ai_model, cfg.ai_revision)
            positive = [int(k) for k, v in model.config.id2label.items() if v.casefold() == cfg.ai_positive_label.casefold()]
            if len(positive) != 1:
                raise ValueError("Configured positive label not found")
            context = min(512, tokenizer.model_max_length)
            sentence_tokens = [len(tokenizer(s["text"], add_special_tokens=False)["input_ids"]) for s in sentences]
            omitted = sum(len(tokens(s["text"])) for s, n in zip(sentences, sentence_tokens) if n > context - 2)
            sentences = [s | {"model_tokens": n} for s, n in zip(sentences, sentence_tokens) if n <= context - 2]
            if sum(len(tokens(s["text"])) for s in sentences) < cfg.ai_min_words:
                return base | {"status": "insufficient_text", "reason": "Too little prose fits the classifier context after excluding oversized sentences.", "omitted_words": omitted}
            # Token-aware windows never label unseen, silently truncated sentences.
            windows = []
            i = 0
            while i < len(sentences):
                group = []; count = 0; token_count = 2
                for s in sentences[i:i + 8]:
                    if group and (count + len(tokens(s["text"])) > 250 or token_count + s["model_tokens"] + 1 > context):
                        break
                    group.append(s); count += len(tokens(s["text"])); token_count += s["model_tokens"] + 1
                if group:
                    windows.append(group)
                i += max(1, min(4, len(group)))
            values = [[] for _ in sentences]
            positions = {s["start"]: i for i, s in enumerate(sentences)}
            for group in windows:
                encoded = tokenizer(" ".join(s["text"] for s in group), return_tensors="pt", truncation=False)
                if encoded["input_ids"].shape[-1] > context:
                    raise ValueError("Window exceeds context; refusing to score unseen text")
                with torch.inference_mode():
                    score = float(torch.softmax(model(**encoded).logits, dim=-1)[0, positive[0]])
                for s in group:
                    values[positions[s["start"]]].append(score)
            scored = [s | {"model_score": round(statistics.mean(v), 5), "words": len(tokens(s["text"]))} for s, v in zip(sentences, values) if v]
            total = sum(s["words"] for s in scored)
            return base | {"status": "completed", "model": cfg.ai_model + "@" + cfg.ai_revision,
                           "percentage": round(100 * sum(s["words"] for s in scored if s["model_score"] >= cfg.ai_threshold) / max(1, total), 2),
                           "mean_model_score": sum(s["model_score"] * s["words"] for s in scored) / max(1, total),
                           "definition": "Percentage of eligible words in sentences whose projected model score meets the configured threshold; not probability of AI authorship.",
                           "threshold": cfg.ai_threshold, "sentences": scored,
                           "coverage": {"scored_words": total, "omitted_oversized_sentence_words": omitted},
                           "perplexity": perplexity(prose, cfg)}
    except Exception as exc:
        return base | {"status": "unavailable", "reason": "Classifier failed to load or run: " + type(exc).__name__}
