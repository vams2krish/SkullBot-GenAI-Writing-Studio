# Evaluation contract

## Separate engineering correctness from model quality

Unit/integration tests verify offsets, coverage, parsing, isolation, missing-model behavior and queue/report flows. They do not establish AI accuracy or commercial source coverage. A model smoke test only establishes that actual model weights execute, not that its prediction is correct.

## Dataset matrix

Use legally obtained/consented human academic writing across disciplines, language proficiency levels, educational levels and editing histories. Keep provenance, license, author/group ID and consent separately. Generated data must record model family/version, prompt, temperature, generation date, task, language, paraphraser/human edits and exact transformations. Do not treat a teacher's suspicion or a detector's output as ground truth.

Hold out authors, source documents and generation tasks. Reserve unseen model families and future timestamps for generalization tests. Include exact copied spans, punctuation/case/OCR variants, near-duplicate islands, light/heavy paraphrases, legitimate shared terminology, properly quoted/cited material, references, short documents, tables, formulas, code, human+AI mixtures and non-English/non-native English cohorts. A separate blinded adjudication set is needed for ambiguous or edited documents.

## Metrics

- Retrieval: document/source recall@k, fingerprint collision checks, candidate truncation and corpus coverage.
- Alignment: token/span precision, recall and F1; overlap-union accounting; quote/reference exclusions.
- Semantic: retrieval precision/recall at selected cosine threshold, separated by light/heavy paraphrase and topical similarity negatives. Similar meaning alone is not proof of borrowing.
- AI: document and sentence/window precision/recall/F1, FPR with 95% intervals, Brier/reliability diagrams, coverage/abstention and cohort differences. Report threshold selection data separately from held-out test results. Sentence projection must not be evaluated as independent sentence inference.
- Operations: p50/p95/p99 extraction, lexical, embedding/classifier and queue latency; throughput at fixed hardware and source counts; failure/retry/timeout rates, memory, disk growth and deletion completion.

## Calibration and release gates

Calibrate temperature/isotonic scores on a dedicated partition, choose thresholds against an agreed false-positive tolerance, and evaluate once on untouched tests. Use confidence intervals and cohort sample sizes. Do not claim a low FPR from small synthetic examples. English-only baselines abstain on other languages. Mixed and AI-paraphrased writing need their own representative labels/evaluation; current code makes no quality claim there.

The bundled evaluator consumes actual labeled model predictions and computes confusion metrics and Wilson intervals. No production benchmark numbers are populated with invented results. Export model/dataset/revision/threshold provenance alongside every evaluation. Monitor drift, appeals and human adjudication without feeding disputed allegations directly into training.
