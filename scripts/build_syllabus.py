"""Builds data/syllabus.json from the extracted KSSR DSKP file.

Usage: python scripts/build_syllabus.py <path-to-dskp.jsonl>

Keeps the content and learning standards with their page numbers and source. Leaves out `topics`,
which is noisy (it contains names from the document), and Pendidikan Khas and vernacular-school
variants, so the first version stays focused on mainstream primary subjects.
"""

import json
import re
import sys
from pathlib import Path


def clean(text):
    return re.sub(r"\s+", " ", (text or "")).strip()


def compact(row):
    standards = []
    for sk in row["learning_standards"]:
        sp = [{"c": x["sp_code"], "t": clean(x["sp_description"]), "p": x.get("page")} for x in sk.get("sp", []) if clean(x.get("sp_description"))]
        if clean(sk.get("sk_description")):
            standards.append({"c": sk["sk_code"], "t": clean(sk["sk_description"]), "p": sk.get("page"), "sp": sp})
    return {
        "subject": row["subject"],
        "year": int(row["year"].split("-")[1]),
        "document": row["document"],
        "url": row["source"]["url"],
        "status": row["validation"].get("status", "unverified"),
        "sk": standards,
    }


def main(path):
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf8").splitlines() if line.strip()]
    keep = [r for r in rows if r["subject"] and r["subject"] != "Pendidikan Khas" and r["school_type"] in (None, "SK") and r["learning_standards"]]
    docs = [compact(r) for r in keep]
    out = Path(__file__).resolve().parent.parent / "data" / "syllabus.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(docs, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    print(f"{len(docs)} documents, {sum(len(d['sk']) for d in docs)} content standards, {out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1])
