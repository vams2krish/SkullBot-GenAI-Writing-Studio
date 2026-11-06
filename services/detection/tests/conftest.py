import json
import os
import tempfile

TEST_DIR = tempfile.TemporaryDirectory()
os.environ["DETECTION_DATABASE"] = TEST_DIR.name + "/test.sqlite3"
os.environ["DETECTION_REQUESTS_PER_MINUTE"] = "10000"
os.environ["DETECTION_CREDENTIALS_JSON"] = json.dumps([
    {"token": "a" * 40, "tenant": "alpha", "role": "admin", "principal": "alice"},
    {"token": "b" * 40, "tenant": "alpha", "role": "member", "principal": "bob"},
    {"token": "c" * 40, "tenant": "beta", "role": "admin", "principal": "carol"},
])
