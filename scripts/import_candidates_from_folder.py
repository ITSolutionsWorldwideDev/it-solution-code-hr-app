from __future__ import annotations

import logging
from pathlib import Path
import sys
import time

import requests


API_URL = "http://127.0.0.1:8000/api/candidates/parse-cv"
DEFAULT_DELAY_SECONDS = 1.0


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)


def _load_pdf_files(folder_path: str | Path) -> list[Path]:
    folder = Path(folder_path)
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder}")
    if not folder.is_dir():
        raise NotADirectoryError(f"Path is not a folder: {folder}")

    return sorted(path for path in folder.iterdir() if path.is_file() and path.suffix.lower() == ".pdf")


def import_candidates(folder_path: str | Path, vacancy_id: int | None = None) -> None:
    pdf_files = _load_pdf_files(folder_path)
    total = len(pdf_files)

    if total == 0:
        logging.info("No PDF files found in %s", folder_path)
        return

    success_count = 0
    failure_count = 0

    for index, pdf_path in enumerate(pdf_files, start=1):
        logging.info("Importing candidate %s of %s: %s", index, total, pdf_path.name)
        try:
            with pdf_path.open("rb") as file_handle:
                files = {
                    "file": (pdf_path.name, file_handle, "application/pdf"),
                }
                data: dict[str, str] = {}
                if vacancy_id is not None:
                    data["vacancy_id"] = str(vacancy_id)

                response = requests.post(
                    API_URL,
                    files=files,
                    data=data,
                    timeout=180,
                )

            if response.ok:
                success_count += 1
                payload = response.json()
                candidate = payload.get("candidate", {})
                logging.info(
                    "SUCCESS | file=%s | candidate_id=%s | name=%s",
                    pdf_path.name,
                    candidate.get("id"),
                    candidate.get("name"),
                )
            else:
                failure_count += 1
                logging.error(
                    "FAILED  | file=%s | status=%s | body=%s",
                    pdf_path.name,
                    response.status_code,
                    response.text.strip(),
                )
        except requests.RequestException as exc:
            failure_count += 1
            logging.error("FAILED  | file=%s | error=%s", pdf_path.name, exc)
        except OSError as exc:
            failure_count += 1
            logging.error("FAILED  | file=%s | read_error=%s", pdf_path.name, exc)

        time.sleep(DEFAULT_DELAY_SECONDS)

    logging.info(
        "Import complete | total=%s | succeeded=%s | failed=%s",
        total,
        success_count,
        failure_count,
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python scripts\\import_candidates_from_folder.py "C:\\path\\to\\pdf-folder" [vacancy_id]')
        raise SystemExit(1)

    input_folder = sys.argv[1]
    input_vacancy_id = int(sys.argv[2]) if len(sys.argv) > 2 else None
    import_candidates(input_folder, vacancy_id=input_vacancy_id)
