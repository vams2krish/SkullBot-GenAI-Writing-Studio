"""Download audited public model artifacts and pin their actual Hub revisions locally.

The detector is an English research baseline, NOT a calibrated institutional detector.
"""
from pathlib import Path
import os
from dotenv import dotenv_values
from huggingface_hub import HfApi, snapshot_download
from skullbot_detection.models import embedding_model, classifier

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
    snapshot_download(name, revision=revision, allow_patterns=["*.json", "*.txt", "*.safetensors", "1_Pooling/*"])
embedding_model(embedding, embedding_rev)
classifier(detector, detector_rev)
text = path.read_text(encoding="utf-8") if path.exists() else ""
if path.exists() and "DETECTION_AI_MODEL=" not in text:
    text += f"\nDETECTION_EMBEDDING_MODEL={embedding}\nDETECTION_EMBEDDING_REVISION={embedding_rev}\nDETECTION_AI_MODEL={detector}\nDETECTION_AI_REVISION={detector_rev}\nDETECTION_AI_POSITIVE_LABEL=AI\n"
    path.write_text(text, encoding="utf-8")
print(f"Prepared {embedding}@{embedding_rev} and {detector}@{detector_rev}. English baseline is uncalibrated; pin these revisions in deployment settings.")
