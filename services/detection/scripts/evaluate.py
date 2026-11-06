"""Evaluate held-out model outputs. Input JSONL: label 0/1, score 0..1, optional group.

This intentionally consumes actual predictions; it never invents benchmark accuracy.
"""
import argparse
import json
import math
import statistics


def metrics(rows, threshold=.8):
    if not rows or any(r["label"] not in (0, 1) or not 0 <= r["score"] <= 1 for r in rows):
        raise ValueError("Supply nonempty labeled predictions with scores in [0,1].")
    tp = sum(r["label"] == 1 and r["score"] >= threshold for r in rows)
    fp = sum(r["label"] == 0 and r["score"] >= threshold for r in rows)
    tn = sum(r["label"] == 0 and r["score"] < threshold for r in rows)
    fn = sum(r["label"] == 1 and r["score"] < threshold for r in rows)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    n = fp + tn
    if n:
        p = fp / n; z = 1.96
        centre = (p + z*z/(2*n)) / (1+z*z/n)
        half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / (1+z*z/n)
        interval = [max(0, centre-half), min(1, centre+half)]
    else:
        interval = None
    return {"samples": len(rows), "threshold": threshold, "tp": tp, "fp": fp, "tn": tn, "fn": fn,
            "precision": precision, "recall": recall,
            "f1": 2*precision*recall/(precision+recall) if precision is not None and recall is not None and precision+recall else 0,
            "false_positive_rate": fp/n if n else None, "fpr_95_wilson_interval": interval,
            "brier_score": statistics.mean((r["score"]-r["label"])**2 for r in rows)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("predictions"); parser.add_argument("--threshold", type=float, default=.8)
    args = parser.parse_args()
    with open(args.predictions, encoding="utf-8") as file:
        rows = [json.loads(line) for line in file if line.strip()]
    print(json.dumps({"overall": metrics(rows, args.threshold), "groups": {g: metrics([r for r in rows if r.get("group", "unspecified") == g], args.threshold) for g in sorted({r.get("group", "unspecified") for r in rows})}}, indent=2))
