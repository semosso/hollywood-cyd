"""GET com cache em disco e retry exponencial. Cada URL+params vira um JSON no cache."""
import hashlib
import json
import time
from pathlib import Path

import requests

from .config import CACHE_DIR, USER_AGENT


class HttpError(RuntimeError):
    pass


def _key(url: str, params: dict | None) -> str:
    raw = url + "?" + json.dumps(params or {}, sort_keys=True)
    return hashlib.sha1(raw.encode()).hexdigest()


def cache_path(url: str, params: dict | None, namespace: str = "misc") -> Path:
    cache_dir = CACHE_DIR / namespace
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / (_key(url, params) + ".json")


def get_json(url: str, params: dict | None = None, headers: dict | None = None,
             namespace: str = "misc", ttl_days: int | None = None, retries: int = 4,
             cacheable=None) -> dict:
    """`cacheable(data)` decide se a resposta 200 merece ir ao cache (ex.: OMDb devolve
    200 com "Request limit reached!"; guardar isso por 90 dias apagaria notas)."""
    path = cache_path(url, params, namespace)
    if path.exists():
        if ttl_days is None or (time.time() - path.stat().st_mtime) < ttl_days * 86400:
            return json.loads(path.read_text(encoding="utf-8"))
    h = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        h.update(headers)
    delay = 1.0
    last = None
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=h, timeout=60)
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = float(r.headers.get("Retry-After", delay))
                time.sleep(max(retry_after, delay))
                delay *= 2
                last = HttpError(f"{r.status_code} em {url}")
                continue
            if r.status_code == 401:
                raise HttpError(f"401 em {url}: chave ausente ou inválida")
            r.raise_for_status()
            data = r.json()
            if cacheable is None or cacheable(data):
                path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            return data
        except requests.RequestException as e:
            last = e
            time.sleep(delay)
            delay *= 2
    raise HttpError(f"falhou após {retries} tentativas: {url} ({last})")
