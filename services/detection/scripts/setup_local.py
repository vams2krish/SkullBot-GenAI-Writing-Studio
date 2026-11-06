"""Create local-only service credentials without printing or overwriting secrets."""
import json
from pathlib import Path
import secrets

service = Path(__file__).resolve().parents[1]
root = service.parents[1]
destination = service / ".env"
if destination.exists():
    raise SystemExit("Local service environment already exists; no credentials changed.")
token = secrets.token_urlsafe(48)
credentials = [{"token": token, "tenant": "skullbot-local", "principal": "workspace-owner", "role": "admin"}]
destination.write_text("DETECTION_DATABASE=./data/detection.sqlite3\nDETECTION_CREDENTIALS_JSON='" + json.dumps(credentials) + "'\n", encoding="utf-8")
dev = root / ".dev.vars"
existing = dev.read_text(encoding="utf-8") if dev.exists() else ""
if "DETECTION_SERVICE_KEY=" not in existing and "DETECTION_SERVICE_URL=" not in existing:
    dev.write_text(existing.rstrip() + '\nDETECTION_SERVICE_URL="http://127.0.0.1:8089"\nDETECTION_SERVICE_KEY="' + token + '"\n', encoding="utf-8")
print("Created private local environment; no credential values displayed. Hosted settings were not changed.")
