from __future__ import annotations

import re
import sys
from pathlib import Path


COPY_RE = re.compile(r"^COPY\s+(.+?)\s+\((.+)\)\s+FROM stdin;$")


def decode_copy_value(value: str) -> str | None:
    if value == r"\N":
        return None

    result: list[str] = []
    i = 0
    while i < len(value):
        char = value[i]
        if char != "\\":
            result.append(char)
            i += 1
            continue

        i += 1
        if i >= len(value):
            result.append("\\")
            break

        escaped = value[i]
        mapping = {
            "b": "\b",
            "f": "\f",
            "n": "\n",
            "r": "\r",
            "t": "\t",
            "v": "\v",
            "\\": "\\",
        }
        result.append(mapping.get(escaped, escaped))
        i += 1

    return "".join(result)


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def should_skip_line(line: str) -> bool:
    stripped = line.strip()
    if stripped.startswith(r"\restrict") or stripped.startswith(r"\unrestrict"):
        return True
    if re.match(r"^ALTER\s+(TABLE|TYPE|SEQUENCE)\s+.+\s+OWNER TO\s+.+;$", stripped):
        return True
    return False


def should_skip_statement(statement: str) -> bool:
    stripped = statement.strip()
    return stripped.startswith("ALTER DEFAULT PRIVILEGES ")


def convert_copy_block(header: str, rows: list[str]) -> str:
    match = COPY_RE.match(header.strip())
    if not match:
        raise ValueError(f"Unsupported COPY header: {header}")

    table_name = match.group(1)
    columns = [column.strip() for column in match.group(2).split(",")]
    expected_columns = len(columns)

    if not rows:
        return f"-- Skipped empty COPY block for pgAdmin: {table_name}\n"

    inserts: list[str] = [f"-- Converted from COPY for pgAdmin\nINSERT INTO {table_name} ({', '.join(columns)}) VALUES\n"]

    values_sql: list[str] = []
    for row in rows:
        raw_values = row.rstrip("\n").split("\t")
        if len(raw_values) != expected_columns:
            raise ValueError(
                f"Column count mismatch for {table_name}: expected {expected_columns}, got {len(raw_values)} in row {row[:120]!r}"
            )
        decoded_values = [sql_literal(decode_copy_value(value)) for value in raw_values]
        values_sql.append("    (" + ", ".join(decoded_values) + ")")

    inserts.append(",\n".join(values_sql))
    inserts.append(";\n")
    return "".join(inserts)


def clean_dump(input_path: Path, output_path: Path) -> None:
    lines = input_path.read_text(encoding="utf-8").splitlines(keepends=True)

    output_parts: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if should_skip_line(line):
            i += 1
            continue

        if stripped.startswith("ALTER DEFAULT PRIVILEGES "):
            statement_lines = [line]
            i += 1
            while i < len(lines):
                statement_lines.append(lines[i])
                if lines[i].strip().endswith(";"):
                    i += 1
                    break
                i += 1
            statement = "".join(statement_lines)
            if not should_skip_statement(statement):
                output_parts.append(statement)
            continue

        if stripped.startswith("COPY "):
            copy_header = line.rstrip("\n")
            copy_rows: list[str] = []
            i += 1
            while i < len(lines):
                copy_line = lines[i]
                if copy_line.strip() == r"\.":
                    i += 1
                    break
                copy_rows.append(copy_line)
                i += 1
            output_parts.append(convert_copy_block(copy_header, copy_rows))
            continue

        output_parts.append(line)
        i += 1

    output_path.write_text("".join(output_parts), encoding="utf-8")


def main() -> int:
    if len(sys.argv) not in {2, 3}:
        print("Usage: python scripts/clean_pg_dump_for_pgadmin.py <input.sql> [output.sql]")
        return 1

    input_path = Path(sys.argv[1]).resolve()
    if len(sys.argv) == 3:
        output_path = Path(sys.argv[2]).resolve()
    else:
        output_path = input_path.with_name(input_path.stem + ".pgadmin.sql")

    clean_dump(input_path, output_path)
    print(f"Created cleaned dump: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
