"""Operator-only, allowlisted ingestion; never expose this CLI to arbitrary user URLs.

Use an egress firewall for production DNS-rebinding protection. Redirects are disabled.
"""
import argparse
import ipaddress
import os
import socket
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
import httpx
from skullbot_detection.ingestion import extract
from skullbot_detection.repository import Repository
from skullbot_detection.config import settings

parser = argparse.ArgumentParser(); parser.add_argument("urls", nargs="+"); parser.add_argument("--tenant", required=True)
args = parser.parse_args(); cfg = settings()
allowed = {h.strip().lower() for h in cfg.crawler_allow_hosts.split(",") if h.strip()}
repository = Repository(cfg.database, cfg.shingle_words, cfg.winnow_window)
agent = "SkullBotResearchIndexer/0.2"


def public(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in allowed or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Only explicitly allowlisted HTTPS hosts on port 443 are permitted.")
    addresses = socket.getaddrinfo(parsed.hostname, 443)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError("Private, reserved or mixed DNS addresses are forbidden.")
    return parsed


with httpx.Client(headers={"User-Agent": agent}, follow_redirects=False, timeout=15) as client:
    for url in args.urls:
        parsed = public(url)
        robots_url = f"https://{parsed.hostname}/robots.txt"
        public(robots_url)
        robot = RobotFileParser()
        with client.stream("GET", robots_url) as response:
            if response.status_code != 200:
                raise SystemExit("robots.txt unavailable; fail closed.")
            rules = bytearray()
            for chunk in response.iter_bytes():
                rules.extend(chunk)
                if len(rules) > 100_000:
                    raise SystemExit("robots.txt oversized; fail closed.")
        robot.parse(rules.decode("utf-8", errors="replace").splitlines())
        if not robot.can_fetch(agent, url):
            raise SystemExit("robots.txt disallows this URL.")
        time.sleep(max(2, robot.crawl_delay(agent) or robot.crawl_delay("*") or 2))
        public(url)
        with client.stream("GET", url) as response:
            response.raise_for_status()
            if "text/html" not in response.headers.get("content-type", ""):
                raise SystemExit("Only HTML pages are supported by this crawler.")
            data = bytearray()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > 1_000_000:
                    raise SystemExit("Page exceeds crawl limit.")
        result = extract(bytes(data), "page.html")
        source = repository.index(args.tenant, "operator-crawler", url, result["text"], url, cfg.max_sources)
        print(source["id"], "indexed")
