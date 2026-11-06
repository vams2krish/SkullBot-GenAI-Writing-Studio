"""Auditable, pinned model choices. Client requests never supply arbitrary Hub IDs."""
import json
import os
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("model_catalog.json").read_text(encoding="utf-8"))


def model_cache(name):
    if name not in (CATALOG['ai']['desklib']['name'], CATALOG['embedding']['e5']['name']):
        return None
    return os.environ.get('DETECTION_ADDITIONAL_MODEL_CACHE') or str(Path(__file__).resolve().parents[1] / 'models' / 'hub')


def select_models(cfg, ai_profile="default", embedding_profile="default"):
    updates = {}
    for kind, profile in [("ai", ai_profile), ("embedding", embedding_profile)]:
        if profile == "default":
            continue
        if profile not in CATALOG[kind]:
            raise ValueError("Unknown model profile.")
        item = CATALOG[kind][profile]
        updates[kind + "_model"] = item["name"]
        updates[kind + "_revision"] = item["revision"]
        if kind == "ai":
            updates["ai_positive_label"] = "AI"
    return cfg.model_copy(update=updates)


def available_models():
    result = {}
    for kind, models in CATALOG.items():
        result[kind] = []
        for item in models.values():
            ready = False
            try:
                from huggingface_hub import try_to_load_from_cache
                path = try_to_load_from_cache(item["name"], "model.safetensors", revision=item["revision"],cache_dir=model_cache(item['name']))
                ready = isinstance(path, str) and Path(path).exists()
            except ImportError:
                pass
            result[kind].append(item | {"cached": ready})
    return result
