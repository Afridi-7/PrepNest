-- ============================================================================
-- PrepNest — Supabase Row-Level Security (RLS) policies
-- ============================================================================
--
-- Scope
-- -----
-- RLS is enabled ONLY on tables holding user-owned / sensitive data.
-- Tables with curated public content (subjects, topics, mcqs, tips, etc.)
-- are intentionally LEFT WITHOUT RLS — they are designed to be readable by
-- anyone, RLS would add no security value and only add overhead.
--
-- Tables protected by RLS:
--   users               (PII: emails, password hashes, tokens, preferences)
--   conversations       (user chat threads)
--   messages            (chat content)
--   file_assets         (user uploads metadata + storage paths)
--   user_notes          (user-uploaded study notes)
--   mock_tests          (per-user test attempts + scores)
--   practice_results    (per-user practice history)
--   acknowledgments     (per-user acknowledgments)
--
-- Tables intentionally NOT under RLS (public, immutable curated content):
--   subjects, topics, materials, mcqs, tips, resources, notes, past_papers,
--   subject_resources, contact_info, essay_prompts
--
-- The backend connects with the Supabase service_role (or postgres) role,
-- which BYPASSES RLS entirely. Therefore enabling RLS does not change any
-- API behavior — it only blocks anon / authenticated keys from reading or
-- writing user-owned tables if those keys are ever exposed.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable + force RLS on user-owned tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acknowledgments    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.file_assets        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mock_tests         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.practice_results   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.acknowledgments    FORCE ROW LEVEL SECURITY;

-- Drop any prior versions so the script is idempotent.
DROP POLICY IF EXISTS "deny_anon_users"            ON public.users;
DROP POLICY IF EXISTS "deny_anon_conversations"    ON public.conversations;
DROP POLICY IF EXISTS "deny_anon_messages"         ON public.messages;
DROP POLICY IF EXISTS "deny_anon_file_assets"      ON public.file_assets;
DROP POLICY IF EXISTS "deny_anon_user_notes"       ON public.user_notes;
DROP POLICY IF EXISTS "deny_anon_mock_tests"       ON public.mock_tests;
DROP POLICY IF EXISTS "deny_anon_practice_results" ON public.practice_results;
DROP POLICY IF EXISTS "deny_anon_acknowledgments"  ON public.acknowledgments;

-- A policy that returns FALSE for anon/authenticated roles → no rows visible,
-- no inserts/updates/deletes accepted. service_role bypasses RLS entirely.
CREATE POLICY "deny_anon_users"            ON public.users            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_conversations"    ON public.conversations    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_messages"         ON public.messages         FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_file_assets"      ON public.file_assets      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_user_notes"       ON public.user_notes       FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_mock_tests"       ON public.mock_tests       FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_practice_results" ON public.practice_results FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_acknowledgments"  ON public.acknowledgments  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- 2. Roll back any prior RLS on public-content tables (clean slate)
-- ----------------------------------------------------------------------------
-- A previous version of this script also enabled RLS + a public-read policy
-- on these. They are public content, so RLS adds nothing — disable it again.
DROP POLICY IF EXISTS "public_read_subjects"          ON public.subjects;
DROP POLICY IF EXISTS "public_read_topics"            ON public.topics;
DROP POLICY IF EXISTS "public_read_materials"         ON public.materials;
DROP POLICY IF EXISTS "public_read_mcqs"              ON public.mcqs;
DROP POLICY IF EXISTS "public_read_tips"              ON public.tips;
DROP POLICY IF EXISTS "public_read_resources"         ON public.resources;
DROP POLICY IF EXISTS "public_read_notes"             ON public.notes;
DROP POLICY IF EXISTS "public_read_past_papers"       ON public.past_papers;
DROP POLICY IF EXISTS "public_read_subject_resources" ON public.subject_resources;
DROP POLICY IF EXISTS "public_read_contact_info"      ON public.contact_info;
DROP POLICY IF EXISTS "public_read_essay_prompts"     ON public.essay_prompts;

ALTER TABLE public.subjects          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.topics            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.materials         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcqs              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tips              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.resources         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notes             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.past_papers       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subject_resources NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_info      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.essay_prompts     NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subjects          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcqs              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_papers       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_info      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_prompts     DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Sanity check
-- ----------------------------------------------------------------------------
--   SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--   ORDER BY c.relname;
-- ============================================================================

