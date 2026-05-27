from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db import init_db  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.db import engine  # noqa: E402
from app.services.candidate_service import backfill_candidate_hidden_potentials  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Recompute hidden-potential vacancy matching for existing candidates."
    )
    parser.add_argument(
        "--candidate-id",
        type=int,
        default=None,
        help="Optional candidate id to backfill only one candidate.",
    )
    args = parser.parse_args()

    init_db()

    with Session(engine) as session:
        result = backfill_candidate_hidden_potentials(
            session,
            candidate_id=args.candidate_id,
        )

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
