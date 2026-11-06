# Detection implementation verification — November 6, 2026

## Automated verification
- 58 JavaScript/TypeScript tests passed, including the existing writing/TurnitOFF suite and new fingerprint coverage, exclusions, Unicode offsets and winnowing properties.
- 22 Python tests passed: PDF/DOCX/PPTX/HTML/RTF/text extraction, sentence abbreviations/decimals, original offsets, collision-checked coverage, partial copies, duplicate overlap, source exclusions, source versions, authentication, tenant/report-owner isolation, no-index defaults, explicit opt-in indexing, safe exports, independent poll/write rate limits, queue saturation, institution-controlled member indexing, duplicate IDs and declared/chunked body bounds.
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

## APA and additional-model update

- All four alignment buttons were exercised in Chrome. APA standard selects left alignment; custom reset selects justify. Advanced controls update the preview.
- Automated tests inspect generated DOCX XML for all four alignments and all seven font families, font sizes, line spacing and paragraph gaps. Titles remain centered; reference paragraphs remain left aligned and hanging.
- The actual `/api/export` endpoint returned a valid 10,705-byte DOCX using Georgia 11 pt, 1.5 spacing, 6/12 pt gaps and justification. ZIP integrity and font/alignment XML were checked. Physical browser saving and Word pagination were not verified.
- Real pinned Desklib weights loaded and produced logits; E5 generated 384-dimensional normalized embeddings. A queued HTTP submission selecting Desklib + E5 completed through the local gateway, classifier, semantic engine and report. This is an inference smoke test, not an accuracy benchmark.
- Citation search returned DOI-backed Crossref records. E5 metadata ranking scored a leadership candidate 0.83844 and a marine-chemistry candidate 0.72722 for the cross-cultural leadership query. Similarity is relevance, not claim verification. Browser search, model selection and adding the retrieved Jackson (2016) source were verified.
- Refreshed screenshots show actual APA controls, source search and model selection/results. New model weights and credentials are excluded from Git.
