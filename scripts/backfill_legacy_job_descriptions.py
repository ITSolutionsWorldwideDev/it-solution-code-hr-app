from __future__ import annotations

import json
from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlmodel import Session  # noqa: E402

from app.db import engine, init_db  # noqa: E402
from app.services.vacancy_service import backfill_legacy_vacancy_descriptions  # noqa: E402
from app.services.website_publish_service import backfill_published_job_content  # noqa: E402


def main() -> int:
    init_db()

    with Session(engine) as session:
        updated_vacancies = backfill_legacy_vacancy_descriptions(session)
        updated_published_jobs = backfill_published_job_content(session)

    print(
        json.dumps(
            {
                "updated_legacy_vacancies": updated_vacancies,
                "updated_published_jobs": updated_published_jobs,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
