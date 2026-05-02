-- ─────────────────────────────────────────────────────────────────────────────
-- One-time migration: copy legacy past papers from `materials` → `past_papers`
--
-- Background:
--   The original admin "Past Paper" form wrote rows into the generic
--   `materials` table with type='past_paper'. The subject page reads from
--   the newer `past_papers` table, so legacy uploads stopped showing up.
--
--   This script copies every legacy row into the new table without
--   touching the originals — so it is safe to re-run (idempotent via the
--   NOT EXISTS guard on file_path + subject_id).
--
-- Run this in the Supabase SQL editor. Wrapped in a transaction so it
-- either fully succeeds or rolls back.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Preview what will be migrated (read-only). Comment out if you don't care.
SELECT
  m.id          AS material_id,
  m.title,
  m.content     AS file_url,
  t.subject_id,
  m.created_at
FROM materials m
JOIN topics t ON t.id = m.topic_id
WHERE m.type = 'past_paper'
  AND NOT EXISTS (
    SELECT 1 FROM past_papers p
    WHERE p.subject_id = t.subject_id AND p.file_path = m.content
  )
ORDER BY t.subject_id, m.created_at;

-- Actual copy. chapter_id stays NULL because the legacy schema didn't track it.
INSERT INTO past_papers (title, file_path, subject_id, chapter_id, created_at)
SELECT
  m.title,
  m.content,           -- legacy "content" field holds the public PDF URL
  t.subject_id,
  NULL,
  m.created_at
FROM materials m
JOIN topics t ON t.id = m.topic_id
WHERE m.type = 'past_paper'
  AND NOT EXISTS (
    SELECT 1 FROM past_papers p
    WHERE p.subject_id = t.subject_id AND p.file_path = m.content
  );

-- Sanity check: how many ended up in the new table per subject.
SELECT subject_id, COUNT(*) AS paper_count
FROM past_papers
GROUP BY subject_id
ORDER BY subject_id;

COMMIT;
