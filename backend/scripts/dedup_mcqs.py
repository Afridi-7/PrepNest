"""
De-duplicate MCQs that share the same four options within the same topic.

Duplicates are identified by normalizing all four option texts (lowercase,
stripped whitespace) and grouping by (topic_id, sorted option set).  Within
each group the MCQ with the lowest id is kept; the rest are deleted.

Usage:
    cd backend
    python scripts/dedup_mcqs.py          # dry-run (prints what would be deleted)
    python scripts/dedup_mcqs.py --apply  # actually deletes duplicates
"""

import asyncio
import sys
from collections import defaultdict

from sqlalchemy import select

# Allow running from backend/ directory
sys.path.insert(0, ".")

from app.db.models import MCQ            # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def _option_key(mcq) -> tuple:
    """Return a hashable key from the four normalised options (sorted)."""
    opts = sorted(
        s.strip().lower()
        for s in (mcq.option_a, mcq.option_b, mcq.option_c, mcq.option_d)
    )
    return (mcq.topic_id, tuple(opts))


async def run(apply: bool):
    async with SessionLocal() as db:
        result = await db.execute(select(MCQ).order_by(MCQ.id.asc()))
        all_mcqs = result.scalars().all()

    # Group by (topic_id, normalised sorted options)
    groups: dict[tuple, list] = defaultdict(list)
    for mcq in all_mcqs:
        groups[_option_key(mcq)].append(mcq)

    to_delete_ids: list[int] = []
    for key, group in groups.items():
        if len(group) <= 1:
            continue
        keep = group[0]
        dupes = group[1:]
        print(
            f"Topic {key[0]} | options {key[1][:2]}... "
            f"-> keeping id={keep.id} ({keep.question[:50]}), "
            f"deleting {len(dupes)} dupes: {[m.id for m in dupes]}"
        )
        to_delete_ids.extend(m.id for m in dupes)

    print(f"\nTotal MCQs: {len(all_mcqs)}")
    print(f"Duplicate groups: {sum(1 for g in groups.values() if len(g) > 1)}")
    print(f"MCQs to delete: {len(to_delete_ids)}")
    print(f"MCQs remaining after dedup: {len(all_mcqs) - len(to_delete_ids)}")

    if not apply:
        print("\n[DRY RUN] No changes made. Re-run with --apply to delete duplicates.")
        return

    # Delete duplicates
    async with SessionLocal() as db:
        for mcq_id in to_delete_ids:
            obj = await db.get(MCQ, mcq_id)
            if obj:
                await db.delete(obj)
        await db.commit()
    print(f"\n[DONE] Deleted {len(to_delete_ids)} duplicate MCQs.")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    asyncio.run(run(apply))
