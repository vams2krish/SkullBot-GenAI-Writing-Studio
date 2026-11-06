"""SQLite reference repository. All lookups include the credential-derived tenant."""
import hashlib
import json
from pathlib import Path
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from .lexical import fingerprint


class Repository:
    def __init__(self, path, size=5, window=4):
        self.path, self.size, self.window = path, size, window
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,tenant TEXT,author_id TEXT,title TEXT,url TEXT,text TEXT,digest TEXT,version INTEGER,created TEXT);
            CREATE INDEX IF NOT EXISTS source_tenant ON sources(tenant);
            CREATE TABLE IF NOT EXISTS fingerprints(tenant TEXT,hash TEXT,source_id TEXT,position INTEGER);
            CREATE INDEX IF NOT EXISTS fingerprint_lookup ON fingerprints(tenant,hash);
            CREATE INDEX IF NOT EXISTS fingerprint_source ON fingerprints(source_id);
            CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,tenant TEXT,owner TEXT,status TEXT,created TEXT,report TEXT,error TEXT);
            CREATE TABLE IF NOT EXISTS vectors(tenant TEXT,source_id TEXT,model TEXT,data TEXT,PRIMARY KEY(tenant,source_id,model));
            CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT);
            """)
            version = f"blake2b64-nfkc-casefold-v1:{size}:{window}"
            old = db.execute("SELECT value FROM metadata WHERE key='fingerprint_version'").fetchone()
            if not old or old[0] != version:
                db.execute("DELETE FROM fingerprints")
                for source in db.execute("SELECT id,tenant,text FROM sources").fetchall():
                    db.executemany("INSERT INTO fingerprints VALUES(?,?,?,?)", [(source["tenant"], h, source["id"], p) for p, h in fingerprint(source["text"], size, window)])
                db.execute("INSERT OR REPLACE INTO metadata VALUES('fingerprint_version',?)", (version,))

    @contextmanager
    def connection(self):
        with sqlite3.connect(self.path, timeout=30) as db:
            db.row_factory = sqlite3.Row
            yield db

    def index(self, tenant, author, title, text, url="", limit=500):
        digest = hashlib.sha256(text.encode()).hexdigest()
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT * FROM sources WHERE tenant=? AND author_id=? AND digest=?", (tenant, author, digest)).fetchone()
            if old:
                return dict(old)
            if db.execute("SELECT COUNT(*) FROM sources WHERE tenant=?", (tenant,)).fetchone()[0] >= limit:
                raise ValueError("Repository source limit reached; remove sources or increase capacity.")
            version = db.execute("SELECT COALESCE(MAX(version),0)+1 FROM sources WHERE tenant=? AND author_id=? AND title=?", (tenant, author, title)).fetchone()[0]
            row = {"id": str(uuid4()), "tenant": tenant, "author_id": author, "title": title, "url": url,
                   "text": text, "digest": digest, "version": version, "created": datetime.now(timezone.utc).isoformat()}
            db.execute("INSERT INTO sources VALUES(:id,:tenant,:author_id,:title,:url,:text,:digest,:version,:created)", row)
            db.executemany("INSERT INTO fingerprints VALUES(?,?,?,?)", [(tenant, h, row["id"], p) for p, h in fingerprint(text, self.size, self.window)])
            return row

    def sources(self, tenant, include_text=True):
        with self.connection() as db:
            fields = "*" if include_text else "id,title,url,author_id,version,created"
            return [dict(r) for r in db.execute(f"SELECT {fields} FROM sources WHERE tenant=? ORDER BY created DESC", (tenant,))]

    def candidates(self, tenant, text, limit=100):
        hashes = sorted(set(h for _, h in fingerprint(text, self.size, self.window)))
        counts = {}
        with self.connection() as db:
            for start in range(0, len(hashes), 400):
                batch = hashes[start:start + 400]
                marks = ",".join("?" for _ in batch)
                for row in db.execute(f"SELECT source_id,COUNT(DISTINCT hash) n FROM fingerprints WHERE tenant=? AND hash IN ({marks}) GROUP BY source_id", [tenant, *batch]):
                    counts[row["source_id"]] = counts.get(row["source_id"], 0) + row["n"]
            ids = sorted(counts, key=lambda k: -counts[k])[:limit]
            return [dict(db.execute("SELECT * FROM sources WHERE tenant=? AND id=?", (tenant, id)).fetchone()) for id in ids]

    def delete_source(self, tenant, id):
        with self.connection() as db:
            exists = db.execute("DELETE FROM sources WHERE tenant=? AND id=?", (tenant, id)).rowcount
            if exists:
                db.execute("DELETE FROM fingerprints WHERE tenant=? AND source_id=?", (tenant, id))
                db.execute("DELETE FROM vectors WHERE tenant=? AND source_id=?", (tenant, id))
            return bool(exists)

    def vectors(self, tenant, source_id, model, data=None):
        with self.connection() as db:
            if data is not None:
                db.execute("INSERT OR REPLACE INTO vectors VALUES(?,?,?,?)", (tenant, source_id, model, json.dumps(data)))
                return data
            row = db.execute("SELECT data FROM vectors WHERE tenant=? AND source_id=? AND model=?", (tenant, source_id, model)).fetchone()
            return json.loads(row[0]) if row else None

    def create_job(self, tenant, owner, id):
        with self.connection() as db:
            db.execute("INSERT INTO jobs VALUES(?,?,?,?,?,?,?)", (id, tenant, owner, "queued", datetime.now(timezone.utc).isoformat(), None, None))

    def finish(self, id, status, report=None, error=None):
        with self.connection() as db:
            db.execute("UPDATE jobs SET status=?,report=?,error=? WHERE id=?", (status, json.dumps(report) if report is not None else None, error, id))

    def job(self, tenant, owner, id):
        with self.connection() as db:
            row = db.execute("SELECT * FROM jobs WHERE tenant=? AND owner=? AND id=?", (tenant, owner, id)).fetchone()
            if not row:
                return None
            result = dict(row)
            result["report"] = json.loads(result["report"]) if result["report"] else None
            return result

    def delete_job(self, tenant, owner, id):
        with self.connection() as db:
            return bool(db.execute("DELETE FROM jobs WHERE tenant=? AND owner=? AND id=? AND status NOT IN ('queued','running')", (tenant, owner, id)).rowcount)

    def recover(self, hours):
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        with self.connection() as db:
            db.execute("DELETE FROM jobs WHERE created<?", (cutoff,))
            db.execute("UPDATE jobs SET status='failed',error='Worker restarted; resubmit the document.' WHERE status IN ('queued','running')")

    def expire(self, hours):
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        with self.connection() as db:
            db.execute("DELETE FROM jobs WHERE created<? AND status NOT IN ('queued','running')", (cutoff,))
