# SkullBot Detection Service

Working single-instance foundation and optional research models. **Not a validated replacement for Turnitin.** See [architecture and limitations](../../docs/detection/ARCHITECTURE.md).

## Local development (Windows PowerShell)

From the repository root:

```powershell
py -3.11 -m venv services/detection/.venv
services/detection/.venv/Scripts/python.exe -m pip install -r services/detection/requirements.txt
services/detection/.venv/Scripts/python.exe services/detection/scripts/setup_local.py
Set-Location services/detection
.venv/Scripts/python.exe -m uvicorn skullbot_detection.api:app --host 127.0.0.1 --port 8089 --workers 1
```

The setup script writes a private `.env` and, when absent, appends local gateway settings to root `.dev.vars`, without printing keys. It does not change hosted runtime settings or existing credentials. Run the existing app with `npm run dev` in a separate terminal. A development-only Vite/Node bridge connects the Windows loopback service; production uses the Worker gateway. Restart its dev server after environment changes. The app should display “Private detection service connected.” Sources and reports are plaintext in the local SQLite volume; use an encrypted disk and appropriate access permissions.

## Optional real model inference

```powershell
.venv/Scripts/python.exe -m pip install -r requirements-ml.txt
$env:PYTHONPATH=$PWD.Path
.venv/Scripts/python.exe scripts/prepare_models.py
```

Restart the service after model settings change. This downloads MiniLM embeddings and an **English Fakespot RoBERTa experimental classifier**, pins actual Hub commit revisions in private `.env`, and uses safetensors. Models may require several hundred MB of disk/memory and network access. No API provider key is required. Production must replace and evaluate this baseline for its actual domain. A small modern-model download is not a substitute for representative training/calibration. Configuration is in `.env.example`; empty model paths mean unavailable. For a fine-tuned model set `DETECTION_AI_POSITIVE_LABEL=Generated` and configure its audited path/revision.

## Docker Compose

Generate `.env` first, then:

```text
docker compose config --quiet
docker compose up --build -d
```

Default image omits ML dependencies. Set `INSTALL_ML=true` when building to include CPU inference libraries. Supply pinned model settings and a persistent `/models` cache. Compose binds only `127.0.0.1:8089`. A remote deployment needs a TLS reverse proxy, private ingress, volume encryption/backups, secrets manager and strict resource/egress policies. Keep `--workers 1`: the queue and startup recovery are single-process. Multiple API workers/replicas need the durable broker/lease architecture described in the design. Docker configuration is supplied; actual container build requires a running Docker daemon.

For an ML image, set `INSTALL_ML=true` in the build shell, then build and populate the named model-cache volume before serving: `docker compose run --rm --entrypoint python detection scripts/prepare_models.py`. This downloads only audited model artifacts into the cache and prints nonsecret model revisions. Set/preserve those exact revisions in the deployment environment, then start the API. Inference loads local artifacts only and never downloads model files during a document request.

## Connect hosted SkullBot

Set server-only `DETECTION_SERVICE_URL=https://your-private-api-origin` and `DETECTION_SERVICE_KEY` in the existing Site runtime environment. Use a credential scoped to that Site's tenant/principal. The Worker proxies fixed routes and never exposes the key. A localhost URL will not work from the hosted Cloudflare Worker. This repository does not silently expose the workstation or provision a paid backend host. Until an accessible backend is deployed and configured, the published app provides local lexical/repository matching and accurately marks neural/semantic services unavailable.

## Tests

```text
.venv/Scripts/python.exe -m pytest -q
```

Core tests run without model downloads. They cover extraction (PDF/DOCX/PPTX/HTML/RTF/TXT), Unicode offsets, winnowing properties, exact/partial overlap, exclusions, authentication, tenant/report-owner isolation, source versions, opt-in indexing and HTML escaping. Model smoke tests are separate; baseline output is not an accuracy benchmark.

## Training and evaluation

`scripts/train_classifier.py` provides a supervised PyTorch/Transformers path from an independently licensed JSONL dataset. It checks group-disjoint train/validation splits, saves safetensors and records provenance. Keep a third, untouched test partition outside this training file. `scripts/evaluate.py` computes precision, recall, F1, FPR/Wilson intervals and Brier scores overall/by cohort from actual labeled predictions. No representative training dataset or measured commercial accuracy is bundled.

Targets to validate before institutional rollout: exact source retrieval recall >99% on eligible copies of at least 20 words; span precision/recall reported separately; paraphrase retrieval precision/recall by transformation severity; false-positive rate below the institution's accepted limit with confidence bounds (zero observed false positives on 30 samples is not a meaningful guarantee). Initial latency goals: lexical-only p95 <2 seconds at 100 sources/10k words; model p95 and sustainable throughput measured per CPU/GPU SKU. These are targets, not measured achievements.

## Privacy and index maintenance

Submissions are not indexed by default. An explicit checkbox/API flag stores source text for future tenant matching. Report deletion and source deletion are separate. Completed reports expire lazily after the configured retention period; run a scheduled cleanup for strict deletion deadlines. Source removal deletes fingerprints and cached vectors. The operator crawler CLI only accepts preapproved HTTPS hosts, robots permission and bounded HTML. No open-web or licensed academic corpus is included.
