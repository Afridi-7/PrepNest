from __future__ import annotations

import argparse
import asyncio
import json
import math
import re
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
DEFAULT_DB = ROOT / "prepnest_ai_tutor.db"


LABELS = ("A", "B", "C", "D")
OPTION_COLUMNS = {
    "A": "option_a",
    "B": "option_b",
    "C": "option_c",
    "D": "option_d",
}
PLACEHOLDER_EXPLANATIONS = {"see answer above.", "see answer above", ""}


@dataclass(frozen=True)
class Finding:
    mcq_id: int
    topic: str
    issue_type: str
    detail: str


@dataclass(frozen=True)
class Correction:
    correct_answer: str | None = None
    explanation: str | None = None
    option_a: str | None = None
    option_b: str | None = None
    option_c: str | None = None
    option_d: str | None = None
    reason: str = "manual_math_audit"

    def update_fields(self) -> dict[str, str]:
        values = {
            "correct_answer": self.correct_answer,
            "explanation": self.explanation,
            "option_a": self.option_a,
            "option_b": self.option_b,
            "option_c": self.option_c,
            "option_d": self.option_d,
        }
        return {k: v for k, v in values.items() if v is not None}


# Keep explicit human-audited corrections centralized here. This avoids
# scattered seed-file patches and lets future Quantitative MCQ fixes run
# through the same safe reporting/apply path.
CORRECTIONS: dict[int, Correction] = {}


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def clean_minus(value: str) -> str:
    return value.replace("−", "-").replace("–", "-")


def option_values(row: sqlite3.Row) -> dict[str, str]:
    return {label: normalize_text(row[OPTION_COLUMNS[label]]) for label in LABELS}


def numeric_value(value: str) -> float | None:
    text = clean_minus(normalize_text(value))
    text = re.sub(r"(?i)rs\.?\s*", "", text)
    text = re.sub(r"(?i)\b(cm²|cm2|cm|km/h|km|kg|years?|minutes?|times|%)\b", "", text)
    text = text.strip()
    if not text:
        return None
    m = re.fullmatch(r"([+-]?\d+(?:\.\d+)?)\s*/\s*([+-]?\d+(?:\.\d+)?)", text)
    if m:
        den = float(m.group(2))
        return float(m.group(1)) / den if den else None
    m = re.fullmatch(r"√\(?\s*([+-]?\d+(?:\.\d+)?)\s*\)?", text)
    if m:
        return math.sqrt(float(m.group(1)))
    m = re.fullmatch(r"([+-]?\d+(?:\.\d+)?)\s*√\(?\s*([+-]?\d+(?:\.\d+)?)\s*\)?", text)
    if m:
        return float(m.group(1)) * math.sqrt(float(m.group(2)))
    m = re.search(r"[+-]?\d+(?:\.\d+)?", text.replace(",", ""))
    if m:
        return float(m.group(0))
    return None


def labels_matching_expected(options: dict[str, str], expected: str | float, *, tolerance: float = 1e-6) -> list[str]:
    matches: list[str] = []
    expected_text = normalize_text(str(expected))
    expected_num = float(expected) if isinstance(expected, (int, float)) else numeric_value(expected_text)
    for label, value in options.items():
        if value.lower() == expected_text.lower():
            matches.append(label)
            continue
        if expected_num is not None:
            opt_num = numeric_value(value)
            if opt_num is not None and abs(opt_num - expected_num) <= tolerance:
                matches.append(label)
    return matches


def both_option_labels(options: dict[str, str], correct_labels: list[str]) -> str | None:
    wanted = set(correct_labels)
    for label, value in options.items():
        m = re.fullmatch(r"(?i)both\s+([ABCD])\s+and\s+([ABCD])", normalize_text(value))
        if m and {m.group(1).upper(), m.group(2).upper()} == wanted:
            return label
    return None


def fmt_num(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.3f}".rstrip("0").rstrip(".")


def derive_expected(row: sqlite3.Row) -> tuple[str | float, str] | None:
    q = clean_minus(normalize_text(row["question"]))

    m = re.fullmatch(r"(\d+(?:\.\d+)?)% of what number is (\d+(?:\.\d+)?)\?", q, re.I)
    if m:
        pct, amount = map(float, m.groups())
        value = amount * 100 / pct
        return value, f"Let the number be x. {fmt_num(pct)}% of x = {fmt_num(amount)}, so x = {fmt_num(amount)} × 100 / {fmt_num(pct)} = {fmt_num(value)}."

    m = re.fullmatch(r"What is the value of \(([01]+)\)₂ in the decimal system\?", q, re.I)
    if m:
        bits = m.group(1)
        value = int(bits, 2)
        return value, f"Convert binary {bits}₂ to decimal: {bits}₂ = {value}."

    m = re.fullmatch(r"LCM of ([\d, ]+) and (\d+) is:", q, re.I)
    if m:
        nums = [int(x) for x in re.findall(r"\d+", q)]
        value = math.lcm(*nums)
        return value, f"The least common multiple of {', '.join(map(str, nums))} is {value}."

    m = re.fullmatch(r"A milkman mixes (\d+(?:\.\d+)?) litres of (\d+(?:\.\d+)?)% pure milk with (\d+(?:\.\d+)?) litres of (\d+(?:\.\d+)?)% pure milk\. What is the purity(?: of the mixture)?\?", q, re.I)
    if m:
        l1, p1, l2, p2 = map(float, m.groups())
        value = (l1 * p1 + l2 * p2) / (l1 + l2)
        return f"{fmt_num(value)}%", f"Purity = ({fmt_num(l1)}×{fmt_num(p1)} + {fmt_num(l2)}×{fmt_num(p2)}) / ({fmt_num(l1)}+{fmt_num(l2)}) = {fmt_num(value)}%."

    m = re.fullmatch(r"The cost price of one calculator is Rs\. (\d+(?:\.\d+)?) with a profit of (\d+(?:\.\d+)?)%\. What is the sale price of (\d+) such calculators\?", q, re.I)
    if m:
        cp, profit, count = float(m.group(1)), float(m.group(2)), int(m.group(3))
        value = cp * (1 + profit / 100) * count
        return value, f"Sale price for one = {fmt_num(cp)} × (1 + {fmt_num(profit)}/100) = {fmt_num(cp * (1 + profit / 100))}; for {count} calculators = {fmt_num(value)}."

    m = re.fullmatch(r"Find the marked price of an article that is sold for Rs\. (\d+(?:\.\d+)?) after a discount of (\d+(?:\.\d+)?)%\.", q, re.I)
    if m:
        sp, disc = map(float, m.groups())
        value = sp / (1 - disc / 100)
        return value, f"Selling price = marked price × (1 − discount). So MP = {fmt_num(sp)} / (1 − {fmt_num(disc)}/100) = {fmt_num(value)}."

    m = re.fullmatch(r"An amount of Rs\. (\d+(?:\.\d+)?) was invested at a rate of (\d+(?:\.\d+)?)% for (\d+(?:\.\d+)?) years on a simple interest basis\. What is the total amount in the account after \d+(?:\.\d+)? years\?", q, re.I)
    if m:
        principal, rate, years = map(float, m.groups())
        value = principal * (1 + rate * years / 100)
        return value, f"Simple interest amount = P(1 + rt/100) = {fmt_num(principal)}(1 + {fmt_num(rate)}×{fmt_num(years)}/100) = {fmt_num(value)}."

    m = re.fullmatch(r"The variance of (\d+) values is (\d+(?:\.\d+)?)\. What is the sum of squared deviations from the mean\?", q, re.I)
    if m:
        n, variance = int(m.group(1)), float(m.group(2))
        value = n * variance
        return value, f"Variance = (sum of squared deviations) / n. Therefore sum of squared deviations = {n} × {fmt_num(variance)} = {fmt_num(value)}."

    m = re.fullmatch(r"The sum of squared deviations of (\d+) values from their mean is (\d+(?:\.\d+)?)\. Find the variance\.", q, re.I)
    if m:
        n, ssd = int(m.group(1)), float(m.group(2))
        value = ssd / n
        return value, f"Variance = {fmt_num(ssd)} / {n} = {fmt_num(value)}."

    m = re.fullmatch(r"The sum of squared deviations of (\d+) values from their mean is (\d+(?:\.\d+)?)\. Find the standard deviation\.", q, re.I)
    if m:
        n, ssd = int(m.group(1)), float(m.group(2))
        value = math.sqrt(ssd / n)
        return value, f"Standard deviation = √(sum of squared deviations / n) = √({fmt_num(ssd)}/{n}) = {fmt_num(value)}."

    m = re.fullmatch(r"Standard deviation of ([\d, ]+) is:", q, re.I)
    if m:
        vals = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", q)]
        mean = sum(vals) / len(vals)
        value = math.sqrt(sum((x - mean) ** 2 for x in vals) / len(vals))
        return value, f"Mean = {fmt_num(mean)}; population SD = √(Σ(x-mean)²/{len(vals)}) = {fmt_num(value)}."

    m = re.fullmatch(r"Variance of data ([\d, ]+) is:", q, re.I)
    if m:
        vals = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", q)]
        mean = sum(vals) / len(vals)
        value = sum((x - mean) ** 2 for x in vals) / len(vals)
        return value, f"Mean = {fmt_num(mean)}; population variance = Σ(x-mean)²/{len(vals)} = {fmt_num(value)}."

    m = re.fullmatch(r"Data: ([\d, ]+)\. Standard deviation is:", q, re.I)
    if m:
        vals = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", q)]
        mean = sum(vals) / len(vals)
        value = math.sqrt(sum((x - mean) ** 2 for x in vals) / len(vals))
        return value, f"Mean = {fmt_num(mean)}; population SD = √(Σ(x-mean)²/{len(vals)}) = {fmt_num(value)}."

    m = re.fullmatch(r"Mean of (\d+) numbers is (\d+(?:\.\d+)?)\. One number (\d+(?:\.\d+)?) was misread as (\d+(?:\.\d+)?)\. Corrected mean is:", q, re.I)
    if m:
        n, mean, actual, wrong = int(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))
        value = (n * mean - wrong + actual) / n
        return value, f"Corrected total = {n}×{fmt_num(mean)} − {fmt_num(wrong)} + {fmt_num(actual)}; corrected mean = {fmt_num(value)}."

    m = re.fullmatch(r"Mean of (\d+) observations is (\d+(?:\.\d+)?)\. Later found (\d+(?:\.\d+)?) was read as (\d+(?:\.\d+)?)\. Correct mean is:", q, re.I)
    if m:
        n, mean, actual, wrong = int(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))
        value = (n * mean - wrong + actual) / n
        return value, f"Corrected total = {n}×{fmt_num(mean)} − {fmt_num(wrong)} + {fmt_num(actual)}; corrected mean = {fmt_num(value)}."

    m = re.fullmatch(r"Average of (\d+) numbers is (\d+(?:\.\d+)?)\. If one number (\d+(?:\.\d+)?) is replaced by (\d+(?:\.\d+)?), new mean is:", q, re.I)
    if m:
        n, mean, old, new = int(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))
        value = (n * mean - old + new) / n
        return value, f"New total = {n}×{fmt_num(mean)} − {fmt_num(old)} + {fmt_num(new)}; new mean = {fmt_num(value)}."

    m = re.fullmatch(r"Average of (\d+) numbers is (\d+(?:\.\d+)?)\. A (?:\d+)(?:st|nd|rd|th) number is added making average (\d+(?:\.\d+)?)\. The (?:\d+)(?:st|nd|rd|th) number is:", q, re.I)
    if m:
        n, old_mean, new_mean = int(m.group(1)), float(m.group(2)), float(m.group(3))
        value = (n + 1) * new_mean - n * old_mean
        return value, f"Added value = {n + 1}×{fmt_num(new_mean)} − {n}×{fmt_num(old_mean)} = {fmt_num(value)}."

    m = re.fullmatch(r"Two dice(?: thrown)?\. P\(sum = (\d+)\) =", q, re.I)
    if m:
        target = int(m.group(1))
        ways = sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == target)
        return f"{ways}/36", f"There are {ways} ordered outcomes with sum {target} out of 36 total outcomes, so P = {ways}/36."

    m = re.fullmatch(r"Two dice\. P\(at least one 6\):", q, re.I)
    if m:
        return "11/36", "Use complement: P(at least one 6) = 1 − P(no 6) = 1 − (5/6)² = 11/36."

    m = re.fullmatch(r"A fair die rolled once\. P\(even and > 2\) =", q, re.I)
    if m:
        return "1/3", "The favorable outcomes are 4 and 6, so P = 2/6 = 1/3."

    m = re.fullmatch(r"Three fair coins tossed\. P\(at least 2 tails\) =", q, re.I)
    if m:
        return "1/2", "At least 2 tails means exactly 2 tails or 3 tails: (3 + 1)/8 = 4/8 = 1/2."

    m = re.fullmatch(r"Mean of (\d+) students is (\d+(?:\.\d+)?)\. Mean of boys is (\d+(?:\.\d+)?) and girls is (\d+(?:\.\d+)?)\. Number of boys is:", q, re.I)
    if m:
        total, mean, boys_mean, girls_mean = int(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))
        value = total * (mean - girls_mean) / (boys_mean - girls_mean)
        return value, f"Let boys be b. {fmt_num(boys_mean)}b + {fmt_num(girls_mean)}({total}-b) = {total}×{fmt_num(mean)}, so b = {fmt_num(value)}."

    m = re.fullmatch(r"Winning candidate got (\d+(?:\.\d+)?)% (?:of votes )?and won by (\d+(?:\.\d+)?) votes\. Total votes cast:", q, re.I)
    if m:
        pct, majority = map(float, m.groups())
        value = majority / ((pct - (100 - pct)) / 100)
        return value, f"Vote margin = {fmt_num(pct)}% − {fmt_num(100-pct)}% = {fmt_num(2*pct-100)}%. Total votes = {fmt_num(majority)} / {fmt_num(2*pct-100)}% = {fmt_num(value)}."

    m = re.fullmatch(r"In election, A got (\d+(?:\.\d+)?)% of total votes and won by (\d+(?:\.\d+)?) votes\. Total votes were:", q, re.I)
    if m:
        pct, majority = map(float, m.groups())
        value = majority / ((pct - (100 - pct)) / 100)
        return value, f"Vote margin = {fmt_num(pct)}% − {fmt_num(100-pct)}% = {fmt_num(2*pct-100)}%. Total votes = {fmt_num(value)}."

    m = re.fullmatch(r"Winning candidate got (\d+(?:\.\d+)?)% in election with (\d+(?:\.\d+)?) majority\. Total votes:", q, re.I)
    if m:
        pct, majority = map(float, m.groups())
        value = majority / ((pct - (100 - pct)) / 100)
        return value, f"Vote margin = {fmt_num(2*pct-100)}% of total votes, so total = {fmt_num(majority)} / {fmt_num(2*pct-100)}% = {fmt_num(value)}."

    m = re.fullmatch(r"Mean of n observations is (\d+(?:\.\d+)?) and .* If n = (\d+), sum of all observations is:", q, re.I)
    if m:
        mean, n = float(m.group(1)), int(m.group(2))
        value = mean * n
        return value, f"Sum = mean × n = {fmt_num(mean)} × {n} = {fmt_num(value)}."

    m = re.fullmatch(r"Mean is (\d+(?:\.\d+)?) and the (\d+)(?:st|nd|rd|th) value lies in the middle \(median position\)\. Sum of all values is:", q, re.I)
    if m:
        mean, median_pos = float(m.group(1)), int(m.group(2))
        n = 2 * median_pos - 1
        value = mean * n
        return value, f"If the {median_pos}th value is the median, n = 2×{median_pos} − 1 = {n}. Sum = {fmt_num(mean)}×{n} = {fmt_num(value)}."

    m = re.fullmatch(r"Scores: ([\d, ]+)\. Median score is:", q, re.I)
    if m:
        vals = sorted(float(x) for x in re.findall(r"\d+(?:\.\d+)?", q))
        value = vals[len(vals) // 2]
        return value, f"Sort the scores: {', '.join(fmt_num(v) for v in vals)}. The middle value is {fmt_num(value)}."

    m = re.fullmatch(r"Mean of (\d+) items is (\d+(?:\.\d+)?)\. Sum of all items is:", q, re.I)
    if m:
        n, mean = int(m.group(1)), float(m.group(2))
        value = n * mean
        return value, f"Sum = mean × number of items = {fmt_num(mean)} × {n} = {fmt_num(value)}."

    m = re.fullmatch(r"Data: ([\d, ]+)\. Range is:", q, re.I)
    if m:
        vals = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", q)]
        value = max(vals) - min(vals)
        return value, f"Range = maximum − minimum = {fmt_num(max(vals))} − {fmt_num(min(vals))} = {fmt_num(value)}."

    m = re.fullmatch(r"Cards 1-15 in a box\. P\(multiple of 3 or 5\):", q, re.I)
    if m:
        return "7/15", "From 1 to 15, multiples of 3 or 5 are 3, 5, 6, 9, 10, 12, 15: 7 outcomes out of 15."

    m = re.fullmatch(r"Coefficient of variation = \(SD/Mean\) × 100\. If SD=(\d+(?:\.\d+)?), Mean=(\d+(?:\.\d+)?), CV =", q, re.I)
    if m:
        sd, mean = map(float, m.groups())
        value = sd / mean * 100
        return f"{fmt_num(value)}%", f"CV = (SD/Mean)×100 = ({fmt_num(sd)}/{fmt_num(mean)})×100 = {fmt_num(value)}%."

    return None


def derive_correction(row: sqlite3.Row) -> tuple[Correction | None, Finding | None]:
    derived = derive_expected(row)
    if derived is None:
        return None, None
    expected, explanation = derived
    options = option_values(row)
    matches = labels_matching_expected(options, expected, tolerance=1e-2)
    both_label = both_option_labels(options, matches) if len(matches) == 2 else None
    preferred_label = both_label or (matches[0] if matches else None)
    current = normalize_text(row["correct_answer"]).upper()
    fields: dict[str, str] = {}
    question = clean_minus(normalize_text(row["question"]))

    # Repeated generated rows where the computed answer is valid but the
    # option set needs one surgical repair to avoid missing/multiple correct
    # choices. These are pattern-based, not category-specific, so all six
    # USAT copies are fixed together.
    if not matches and question == "Variance of data 1, 3, 5, 7, 11, 13, 15 is:":
        explanation = "Mean = 55/7 ≈ 7.857; population variance = Σ(x-mean)²/7 ≈ 23.84, so the nearest option is 24."
        preferred_label = "D"
        matches = ["D"]
    elif not matches and question == "Mean is 6 and the 27th value lies in the middle (median position). Sum of all values is:":
        if options.get("D") != "318":
            fields["option_d"] = "318"
        explanation = "If the 27th value is the middle value, n = 2×27 − 1 = 53. Sum = mean × n = 6 × 53 = 318."
        preferred_label = "D"
        matches = ["D"]
    elif len(matches) > 1 and question == "Standard deviation of 2, 4, 6, 8, 10 is:":
        for label in ("C", "D"):
            if options.get(label) in {"√8", "2√2"} and label != "B":
                fields[OPTION_COLUMNS[label]] = "√10"
        preferred_label = "B"
        matches = ["B"]
    elif len(matches) > 1 and question == "A fair die rolled once. P(even and > 2) =":
        if options.get("B") != "2/3":
            fields["option_b"] = "2/3"
        preferred_label = "D"
        matches = ["D"]
    elif len(matches) > 1 and question == "Three fair coins tossed. P(at least 2 tails) =":
        if options.get("D") != "1/4":
            fields["option_d"] = "1/4"
        preferred_label = "A"
        matches = ["A"]

    if preferred_label and current != preferred_label:
        fields["correct_answer"] = preferred_label
    if normalize_text(row["explanation"]).lower() in PLACEHOLDER_EXPLANATIONS:
        fields["explanation"] = explanation

    correction = Correction(**fields, reason="derived_quantitative_math") if fields else None
    finding = None
    if not matches:
        finding = Finding(int(row["id"]), str(row["topic"]), "no_option_matches_derived_answer", str(expected))
    elif len(matches) > 1 and both_label is None:
        finding = Finding(int(row["id"]), str(row["topic"]), "multiple_options_match_derived_answer", ",".join(matches))
    elif current != preferred_label:
        finding = Finding(int(row["id"]), str(row["topic"]), "correct_answer_mismatch", f"current={current} expected={preferred_label}")
    return correction, finding


def load_quant_mcqs(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT
            m.id,
            s.exam_type,
            s.name AS subject,
            t.title AS topic,
            m.question,
            m.option_a,
            m.option_b,
            m.option_c,
            m.option_d,
            m.correct_answer,
            m.explanation
        FROM mcqs m
        JOIN topics t ON t.id = m.topic_id
        JOIN subjects s ON s.id = t.subject_id
        WHERE lower(s.name) LIKE '%quantitative%'
           OR lower(t.title) IN (
              'arithmetic',
              'algebra and functions',
              'geometry',
              'equations',
              'statistics',
              'scenario based / mental mathematics'
           )
        ORDER BY s.exam_type, t.title, m.id
        """
    ).fetchall()


async def load_quant_mcqs_appdb() -> list[dict[str, object]]:
    from sqlalchemy import or_, select  # type: ignore[import-not-found]

    from app.db.models import MCQ, Subject, Topic
    from app.db.session import SessionLocal

    quant_topics = {
        "arithmetic",
        "algebra and functions",
        "geometry",
        "equations",
        "statistics",
        "scenario based / mental mathematics",
    }
    async with SessionLocal() as db:
        result = await db.execute(
            select(MCQ, Subject, Topic)
            .join(Topic, MCQ.topic_id == Topic.id)
            .join(Subject, Topic.subject_id == Subject.id)
            .where(
                or_(
                    Subject.name.ilike("%quantitative%"),
                    Topic.title.in_(quant_topics),
                )
            )
            .order_by(Subject.exam_type.asc(), Topic.title.asc(), MCQ.id.asc())
        )
        rows: list[dict[str, object]] = []
        for mcq, subject, topic in result.all():
            rows.append(
                {
                    "id": mcq.id,
                    "exam_type": subject.exam_type,
                    "subject": subject.name,
                    "topic": topic.title,
                    "question": mcq.question,
                    "option_a": mcq.option_a,
                    "option_b": mcq.option_b,
                    "option_c": mcq.option_c,
                    "option_d": mcq.option_d,
                    "correct_answer": mcq.correct_answer,
                    "explanation": mcq.explanation,
                }
            )
        return rows


def validate_structure(rows: Iterable[sqlite3.Row]) -> list[Finding]:
    findings: list[Finding] = []
    seen_question_text: dict[str, int] = {}

    for row in rows:
        mcq_id = int(row["id"])
        topic = row["topic"]
        correct = normalize_text(row["correct_answer"]).upper()
        options = {label: normalize_text(row[OPTION_COLUMNS[label]]) for label in LABELS}

        if correct not in LABELS:
            findings.append(Finding(mcq_id, topic, "bad_correct_label", f"correct_answer={row['correct_answer']!r}"))

        missing = [label for label, value in options.items() if not value]
        if missing:
            findings.append(Finding(mcq_id, topic, "missing_option", ",".join(missing)))

        duplicate_values: dict[str, list[str]] = {}
        for label, value in options.items():
            duplicate_values.setdefault(value.lower(), []).append(label)
        for value, labels in duplicate_values.items():
            if value and len(labels) > 1:
                findings.append(Finding(mcq_id, topic, "duplicate_option_value", f"{','.join(labels)}={value!r}"))

        if correct in LABELS:
            correct_text = options[correct]
            explanation = normalize_text(row["explanation"])
            if correct_text and correct_text not in explanation:
                # Not always wrong, but useful for audit surfacing.
                findings.append(Finding(mcq_id, topic, "answer_not_named_in_explanation", correct_text))

        qkey = normalize_text(row["question"]).lower()
        if qkey in seen_question_text:
            findings.append(Finding(mcq_id, topic, "duplicate_question_text", f"duplicate_of={seen_question_text[qkey]}"))
        else:
            seen_question_text[qkey] = mcq_id

    return findings


def apply_corrections(conn: sqlite3.Connection, rows: Iterable[sqlite3.Row], *, dry_run: bool) -> list[dict[str, object]]:
    row_ids = {int(row["id"]) for row in rows}
    applied: list[dict[str, object]] = []
    for mcq_id, correction in sorted(CORRECTIONS.items()):
        if mcq_id not in row_ids:
            applied.append({"id": mcq_id, "status": "skipped_not_quantitative", "reason": correction.reason})
            continue
        fields = correction.update_fields()
        if not fields:
            continue
        applied.append({"id": mcq_id, "status": "dry_run" if dry_run else "updated", "fields": sorted(fields), "reason": correction.reason})
        if dry_run:
            continue
        assignments = ", ".join(f"{field} = ?" for field in fields)
        values = [fields[field] for field in fields]
        values.append(mcq_id)
        conn.execute(f"UPDATE mcqs SET {assignments} WHERE id = ?", values)
    if not dry_run:
        conn.commit()
    return applied


def collect_derived(rows: Iterable[sqlite3.Row]) -> tuple[dict[int, Correction], list[Finding]]:
    corrections: dict[int, Correction] = {}
    findings: list[Finding] = []
    for row in rows:
        correction, finding = derive_correction(row)
        if correction is not None:
            corrections[int(row["id"])] = correction
        if finding is not None:
            findings.append(finding)
    return corrections, findings


def apply_correction_map_sqlite(
    conn: sqlite3.Connection,
    corrections: dict[int, Correction],
    *,
    dry_run: bool,
) -> list[dict[str, object]]:
    applied: list[dict[str, object]] = []
    for mcq_id, correction in sorted(corrections.items()):
        fields = correction.update_fields()
        if not fields:
            continue
        applied.append({"id": mcq_id, "status": "dry_run" if dry_run else "updated", "fields": sorted(fields), "reason": correction.reason})
        if dry_run:
            continue
        assignments = ", ".join(f"{field} = ?" for field in fields)
        values = [fields[field] for field in fields]
        values.append(mcq_id)
        conn.execute(f"UPDATE mcqs SET {assignments} WHERE id = ?", values)
    if not dry_run:
        conn.commit()
    return applied


async def apply_corrections_appdb(rows: Iterable[dict[str, object]], *, dry_run: bool) -> list[dict[str, object]]:
    from sqlalchemy import update  # type: ignore[import-not-found]

    from app.db.models import MCQ
    from app.db.session import SessionLocal

    row_ids = {int(row["id"]) for row in rows}
    applied: list[dict[str, object]] = []
    async with SessionLocal() as db:
        for mcq_id, correction in sorted(CORRECTIONS.items()):
            if mcq_id not in row_ids:
                applied.append({"id": mcq_id, "status": "skipped_not_quantitative", "reason": correction.reason})
                continue
            fields = correction.update_fields()
            if not fields:
                continue
            applied.append({"id": mcq_id, "status": "dry_run" if dry_run else "updated", "fields": sorted(fields), "reason": correction.reason})
            if dry_run:
                continue
            await db.execute(update(MCQ).where(MCQ.id == mcq_id).values(**fields))
        if not dry_run:
            await db.commit()
    return applied


async def apply_correction_map_appdb(
    corrections: dict[int, Correction],
    *,
    dry_run: bool,
) -> list[dict[str, object]]:
    from sqlalchemy import update  # type: ignore[import-not-found]

    from app.db.models import MCQ
    from app.db.session import SessionLocal

    applied: list[dict[str, object]] = []
    async with SessionLocal() as db:
        for mcq_id, correction in sorted(corrections.items()):
            fields = correction.update_fields()
            if not fields:
                continue
            applied.append({"id": mcq_id, "status": "dry_run" if dry_run else "updated", "fields": sorted(fields), "reason": correction.reason})
            if dry_run:
                continue
            await db.execute(update(MCQ).where(MCQ.id == mcq_id).values(**fields))
        if not dry_run:
            await db.commit()
    return applied


def compact_row(row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "exam_type": row["exam_type"],
        "topic": row["topic"],
        "question": normalize_text(row["question"]),
        "A": normalize_text(row["option_a"]),
        "B": normalize_text(row["option_b"]),
        "C": normalize_text(row["option_c"]),
        "D": normalize_text(row["option_d"]),
        "correct": normalize_text(row["correct_answer"]),
        "explanation": normalize_text(row["explanation"]),
    }


def question_signature(question: str) -> str:
    value = normalize_text(question).lower()
    value = re.sub(r"\d+(?:\.\d+)?", "#", value)
    value = re.sub(r"\b[a-d]\b", "x", value)
    return value


def pattern_summary(rows: Iterable[sqlite3.Row], *, limit: int) -> list[dict[str, object]]:
    groups: dict[tuple[str, str], list[sqlite3.Row]] = {}
    for row in rows:
        key = (str(row["topic"]), question_signature(str(row["question"])))
        groups.setdefault(key, []).append(row)
    payload: list[dict[str, object]] = []
    for (topic, signature), items in sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)[:limit]:
        payload.append(
            {
                "topic": topic,
                "count": len(items),
                "signature": signature,
                "example": compact_row(items[0]),
            }
        )
    return payload


def finding_counts(findings: Iterable[Finding]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.issue_type] = counts.get(finding.issue_type, 0) + 1
    return dict(sorted(counts.items()))


async def run_appdb(args: argparse.Namespace) -> int:
    rows = await load_quant_mcqs_appdb()
    findings = validate_structure(rows)
    derived_corrections, derived_findings = collect_derived(rows)
    findings.extend(derived_findings)
    applied = await apply_corrections_appdb(rows, dry_run=not args.apply)
    if args.derive:
        applied.extend(await apply_correction_map_appdb(derived_corrections, dry_run=not args.apply))
    categories = sorted({str(row["exam_type"]) for row in rows})
    topics = sorted({str(row["topic"]) for row in rows})
    total_corrections = len(applied)
    summary = {
        "database": "configured_app_database",
        "total_checked": len(rows),
        "categories_affected": categories,
        "topics_affected": topics,
        "structural_findings": len(findings),
        "finding_counts": finding_counts(findings),
        "derived_corrections_available": len(derived_corrections),
        "corrections_total": total_corrections,
        "corrections": applied[: args.correction_limit],
        "corrections_truncated": total_corrections > args.correction_limit,
        "applied": bool(args.apply),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.dump:
        print(json.dumps([compact_row(row) for row in rows], ensure_ascii=False, indent=2))
    elif args.dump_suspects:
        selected_findings = [f for f in findings if args.finding_type in (None, f.issue_type)]
        suspect_ids = {finding.mcq_id for finding in selected_findings}
        payload = {
            "findings": [finding.__dict__ for finding in selected_findings],
            "rows": [compact_row(row) for row in rows if int(row["id"]) in suspect_ids],
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif args.pattern_summary:
        print(json.dumps(pattern_summary(rows, limit=args.pattern_limit), ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and optionally correct Quantitative Reasoning MCQs.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="Path to SQLite database")
    parser.add_argument("--app-db", action="store_true", help="Use the backend's configured database instead of SQLite")
    parser.add_argument("--apply", action="store_true", help="Apply centralized corrections")
    parser.add_argument("--derive", action="store_true", help="Derive answer/explanation corrections from deterministic math templates")
    parser.add_argument("--dump", action="store_true", help="Print all Quantitative MCQs as compact JSON")
    parser.add_argument("--dump-suspects", action="store_true", help="Print rows with structural findings")
    parser.add_argument("--finding-type", default=None, help="When dumping suspects, include only this finding type")
    parser.add_argument("--pattern-summary", action="store_true", help="Print largest normalized question patterns")
    parser.add_argument("--pattern-limit", type=int, default=80, help="Number of patterns to print")
    parser.add_argument("--correction-limit", type=int, default=50, help="Max correction entries printed in the summary")
    args = parser.parse_args()

    if args.app_db:
        return asyncio.run(run_appdb(args))

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    rows = load_quant_mcqs(conn)
    findings = validate_structure(rows)
    derived_corrections, derived_findings = collect_derived(rows)
    findings.extend(derived_findings)
    applied = apply_corrections(conn, rows, dry_run=not args.apply)
    if args.derive:
        applied.extend(apply_correction_map_sqlite(conn, derived_corrections, dry_run=not args.apply))

    categories = sorted({row["exam_type"] for row in rows})
    topics = sorted({row["topic"] for row in rows})
    total_corrections = len(applied)
    summary = {
        "database": str(Path(args.db).resolve()),
        "total_checked": len(rows),
        "categories_affected": categories,
        "topics_affected": topics,
        "structural_findings": len(findings),
        "finding_counts": finding_counts(findings),
        "derived_corrections_available": len(derived_corrections),
        "corrections_total": total_corrections,
        "corrections": applied[: args.correction_limit],
        "corrections_truncated": total_corrections > args.correction_limit,
        "applied": bool(args.apply),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.dump:
        print(json.dumps([compact_row(row) for row in rows], ensure_ascii=False, indent=2))
    elif args.dump_suspects:
        selected_findings = [f for f in findings if args.finding_type in (None, f.issue_type)]
        suspect_ids = {finding.mcq_id for finding in selected_findings}
        payload = {
            "findings": [finding.__dict__ for finding in selected_findings],
            "rows": [compact_row(row) for row in rows if int(row["id"]) in suspect_ids],
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif args.pattern_summary:
        print(json.dumps(pattern_summary(rows, limit=args.pattern_limit), ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())