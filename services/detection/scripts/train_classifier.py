"""Supervised improvement path. Requires an independently licensed, grouped dataset.

JSONL rows: text,label (0 human/1 generated),split (train/validation),group_id.
Group by human author/source document and generation task to prevent split leakage.
No training dataset is bundled or falsely represented as representative academic data.
"""
import argparse
import json
from pathlib import Path
import random
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from evaluate import metrics

parser = argparse.ArgumentParser()
parser.add_argument("dataset"); parser.add_argument("--base-model", required=True)
parser.add_argument("--revision", required=True); parser.add_argument("--output", required=True)
parser.add_argument("--epochs", type=int, default=2); parser.add_argument("--batch-size", type=int, default=8)
args = parser.parse_args()
random.seed(42); torch.manual_seed(42)
rows = [json.loads(line) for line in Path(args.dataset).read_text(encoding="utf-8").splitlines() if line.strip()]
train = [r for r in rows if r["split"] == "train"]
validation = [r for r in rows if r["split"] == "validation"]
if not train or not validation or {r["group_id"] for r in train} & {r["group_id"] for r in validation}:
    raise SystemExit("Provide nonempty group-disjoint train/validation splits.")
if any(r["label"] not in (0, 1) or not isinstance(r["text"], str) for r in rows):
    raise SystemExit("Invalid dataset rows.")
tokenizer = AutoTokenizer.from_pretrained(args.base_model, revision=args.revision, trust_remote_code=False)
model = AutoModelForSequenceClassification.from_pretrained(args.base_model, revision=args.revision, num_labels=2, id2label={0: "Human", 1: "Generated"}, label2id={"Human": 0, "Generated": 1}, ignore_mismatched_sizes=True, use_safetensors=True, trust_remote_code=False)
optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5)
for epoch in range(args.epochs):
    random.shuffle(train); model.train()
    for start in range(0, len(train), args.batch_size):
        batch = train[start:start+args.batch_size]
        encoded = tokenizer([r["text"] for r in batch], padding=True, truncation=True, max_length=512, return_tensors="pt")
        loss = model(**encoded, labels=torch.tensor([r["label"] for r in batch])).loss
        optimizer.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); optimizer.step()
    model.eval(); predictions = []
    with torch.inference_mode():
        for row in validation:
            encoded = tokenizer(row["text"], truncation=True, max_length=512, return_tensors="pt")
            predictions.append({"label": row["label"], "score": float(torch.softmax(model(**encoded).logits, -1)[0, 1])})
    print(json.dumps({"epoch": epoch+1, "validation": metrics(predictions)}))
destination = Path(args.output); destination.mkdir(parents=True, exist_ok=True)
model.save_pretrained(destination, safe_serialization=True); tokenizer.save_pretrained(destination)
(destination / "training-provenance.json").write_text(json.dumps({"base_model": args.base_model, "revision": args.revision, "seed": 42, "train_rows": len(train), "validation_rows": len(validation), "note": "Validation is not a held-out test. Calibrate separately and test on unseen authors, tasks, languages and model families."}, indent=2), encoding="utf-8")
