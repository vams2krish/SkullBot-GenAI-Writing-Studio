# Detection implementation verification — November 6, 2026

## Automated verification
- 54 JavaScript/TypeScript tests passed, including the existing writing/TurnitOFF suite and new fingerprint coverage, exclusions, Unicode offsets and winnowing properties.
- 19 Python tests passed: PDF/DOCX/PPTX/HTML/RTF/text extraction, sentence abbreviations/decimals, original offsets, collision-checked coverage, partial copies, duplicate overlap, source exclusions, source versions, authentication, tenant/report-owner isolation, no-index defaults, explicit opt-in indexing, safe exports, independent poll/write rate limits, queue saturation, institution-controlled member indexing, duplicate IDs and declared/chunked body bounds.
- TypeScript passed; targeted new-code lint passed. Docker Compose configuration validated. Docker image execution was not verified because the Docker daemon is not running on this machine.

## Live pipeline smoke checks
A real HTTP path through the development gateway → FastAPI → queue → repository/embedding/classifier → report completed. The local service uses downloaded safetensors/model files, not heuristic-generated AI percentages.

- Final classifier: `fakespot-ai/roberta-base-ai-text-detection-v1@f9cdb14d1f8b105f597d80fa7b56f20c6ea0e9db`.
- Exact identical supplied-source fixture: 100.0% lexical coverage; no automatic source indexing.
- Experimental classifier returned a word-share indicator; this proves inference runs, not detection accuracy or calibration.
- Paraphrase fixture: 0.0% lexical overlap, one semantic review candidate at cosine 0.8928. Semantic candidates are not added to exact coverage.
- Cold model job: 51157 ms. Warm 444-word job: 1703 ms. Single-fixture timings only, not a throughput/SLA benchmark.
- Server PDF returned valid PDF bytes, source highlights and report text. Its rendered first page was visually inspected. HTML is escaped and has a restrictive CSP; JSON retains full alignments and model metadata.

## Browser checks
- Restored **AI detector** and **Plagiarism checker** labels.
- Supplied-source report showed ranked source, exact highlights, 100% similarity and independent model/semantic results.
- Excluding that source and rerunning reduced lexical coverage to 0% and semantic candidates to zero while the independent AI result remained unchanged.
- Short prose produced no AI percentage and an explicit minimum-length reason.
- All eight import controls returned the expected extracted evidence: TXT, MD, TEX, HTML, RTF, DOCX, PPTX and PDF.
- Mobile form bounds were checked at a compact viewport; a clipped grid field was fixed with zero-minimum grid tracks.
- Browser JSON-download event capture timed out, so that physical saved-file action is not claimed verified. Actual HTTP JSON/PDF outputs and HTML generation were verified independently. The Print/PDF operating-system dialog was not automated.

## Defects found and fixed
- Submission polling originally shared the low write quota and could fail while models loaded. Read/poll quotas are now separate, with a regression test.
- Supplied source IDs were initially position-based. Stable client IDs now survive source reordering/removal; duplicate supplied IDs are rejected.
- Long model windows could silently truncate text. Windows are now token-aware; oversized sentences are excluded and counted instead of assigning scores to unseen text.
- Input edits invalidate in-flight UI generations, preventing stale reports from replacing newer input.
- Windows loopback access from the Worker dev runtime failed. A development-only Node gateway handles local service requests; the hosted Worker retains its fixed-route private backend proxy.

## Delivery boundary
Per the user's instruction, the Python service remains local. The published app can perform on-device fingerprint/source-repository comparisons; neural/semantic capabilities are unavailable there until an accessible service is configured. No licensed web/academic corpus, institutional SSO, distributed broker/vector index, validated modern-LLM false-positive rate, AI-paraphrase accuracy or thousands-of-concurrent-users claim is included. Architecture, training/evaluation paths and production migrations are documented separately.
