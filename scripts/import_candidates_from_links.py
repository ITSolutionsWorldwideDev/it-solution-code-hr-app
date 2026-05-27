from __future__ import annotations

import logging
from pathlib import Path
import sys
import time

import requests


API_URL = "http://127.0.0.1:8000/api/candidates/upload-url"
DEFAULT_DELAY_SECONDS = 1.0


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)


def _load_links(file_path: str | Path) -> list[str]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    links: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        links.append(value)
    return links


def import_candidates(file_path: str | Path) -> None:
    links = _load_links(file_path)
    total = len(links)

    if total == 0:
        logging.info("No links found in %s", file_path)
        return

    success_count = 0
    failure_count = 0

    for index, url in enumerate(links, start=1):
        logging.info("Importing candidate %s of %s: %s", index, total, url)
        try:
            response = requests.post(API_URL, json={"url": url}, timeout=120)
            if response.ok:
                success_count += 1
                payload = response.json()
                candidate = payload.get("candidate", {})
                logging.info(
                    "SUCCESS | URL=%s | candidate_id=%s | name=%s",
                    url,
                    candidate.get("id"),
                    candidate.get("name"),
                )
            else:
                failure_count += 1
                logging.error(
                    "FAILED  | URL=%s | status=%s | body=%s",
                    url,
                    response.status_code,
                    response.text.strip(),
                )
        except requests.RequestException as exc:
            failure_count += 1
            logging.error("FAILED  | URL=%s | error=%s", url, exc)

        time.sleep(DEFAULT_DELAY_SECONDS)

    logging.info(
        "Import complete | total=%s | succeeded=%s | failed=%s",
        total,
        success_count,
        failure_count,
    )


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else "links.txt"
    import_candidates(input_path)
