-- Sprint W4 Day 20 (PR #36) — добавляем 'club-audit' source enum
-- к tool_leads. Org-admin-targeted lead-magnet ("Где теряете
-- управляемость"). Третий из 5 lead-magnets W4:
--   Day 18: team-risk (coach target)
--   Day 19: adaptive-plan (athlete target)
--   Day 20: club-audit (org-admin / club manager target)
--
-- Применено через Supabase MCP 2026-05-09.

ALTER TABLE tool_leads DROP CONSTRAINT IF EXISTS tool_leads_source_check;

ALTER TABLE tool_leads
  ADD CONSTRAINT tool_leads_source_check
  CHECK (source IN ('acwr','overtraining','templates','team-risk','adaptive-plan','club-audit','other'));

NOTIFY pgrst, 'reload schema';
