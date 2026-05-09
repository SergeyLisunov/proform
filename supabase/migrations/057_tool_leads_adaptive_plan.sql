-- Sprint W4 Day 19 (PR #35) — добавляем 'adaptive-plan' source enum
-- к tool_leads. Athlete-targeted lead-magnet (parallel coach-targeted
-- team-risk из Day 18 / migration 056).
--
-- Применено через Supabase MCP 2026-05-09.

ALTER TABLE tool_leads DROP CONSTRAINT IF EXISTS tool_leads_source_check;

ALTER TABLE tool_leads
  ADD CONSTRAINT tool_leads_source_check
  CHECK (source IN ('acwr','overtraining','templates','team-risk','adaptive-plan','other'));

NOTIFY pgrst, 'reload schema';
