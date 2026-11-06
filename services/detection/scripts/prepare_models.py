"""Download audited public model artifacts and pin their actual Hub revisions locally.

The detector is an English research baseline, NOT a calibrated institutional detector.
"""
from pathlib import Path
import os
import re
from dotenv import dotenv_values
from huggingface_hub import HfApi, snapshot_download
from skullbot_detection.models import embedding_model, classifier
from skullbot_detection.model_registry import CATALOG, model_cache
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--additional-profiles", action="store_true", help="Prepare pinned Desklib and multilingual E5 without changing defaults")
args = parser.parse_args()
if args.additional_profiles:
    for group, key in [("ai", "desklib"), ("embedding", "e5")]:
        model = CATALOG[group][key]
        snapshot_download(model["name"], revision=model["revision"], cache_dir=model_cache(model["name"]), allow_patterns=["*.json", "*.txt", "*.model", "*.safetensors", "1_Pooling/*"])
        (classifier if group == "ai" else embedding_model)(model["name"], model["revision"])
        print("Validated profile:", key, model["revision"])
    raise SystemExit(0)

service = Path(__file__).resolve().parents[1]
api = HfApi()
path = service / ".env"
values = dict(dotenv_values(path)) if path.exists() else {}
values.update(os.environ)
embedding = values.get("DETECTION_EMBEDDING_MODEL") or "sentence-transformers/all-MiniLM-L6-v2"
detector = values.get("DETECTION_AI_MODEL") or "fakespot-ai/roberta-base-ai-text-detection-v1"
embedding_rev = api.model_info(embedding, revision=values.get("DETECTION_EMBEDDING_REVISION") or "main").sha
detector_rev = api.model_info(detector, revision=values.get("DETECTION_AI_REVISION") or "main").sha
for name, revision in [(embedding, embedding_rev), (detector, detector_rev)]:
    snapshot_download(name, revision=revision, cache_dir=model_cache(name), allow_patterns=["*.json", "*.txt", "*.model", "*.safetensors", "1_Pooling/*"])
embedding_model(embedding, embedding_rev)
classifier(detector, detector_rev)
text = path.read_text(encoding="utf-8") if path.exists() else ""
if path.exists():
    selected = {"DETECTION_EMBEDDING_MODEL": embedding, "DETECTION_EMBEDDING_REVISION": embedding_rev,
                "DETECTION_AI_MODEL": detector, "DETECTION_AI_REVISION": detector_rev,
                "DETECTION_AI_POSITIVE_LABEL": values.get("DETECTION_AI_POSITIVE_LABEL") or "AI"}
    for key, value in selected.items():
        pattern = rf"(?m)^{key}=.*$"
        if re.search(pattern, text):
            text = re.sub(pattern, lambda match: key + "=" + value, text)
        else:
            text += "\n" + key + "=" + value
    path.write_text(text, encoding="utf-8")
print(f"Prepared {embedding}@{embedding_rev} and {detector}@{detector_rev}. English baseline is uncalibrated; pin these revisions in deployment settings.")
