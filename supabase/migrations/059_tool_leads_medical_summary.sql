-- Sprint W4 Day 21 (PR #37) — добавляем 'medical-summary' source enum
-- к tool_leads. Doctor-targeted lead-magnet (4-я target persona в W4):
--   Day 18: team-risk        (coach)
--   Day 19: adaptive-plan    (athlete)
--   Day 20: club-audit       (org-admin)
--   Day 21: medical-summary  (doctor / sports physician / physiotherapist)
--
-- Применено через Supabase MCP 2026-05-09.

ALTER TABLE tool_leads DROP CONSTRAINT IF EXISTS tool_leads_source_check;

ALTER TABLE tool_leads
  ADD CONSTRAINT tool_leads_source_check
  CHECK (source IN ('acwr','overtraining','templates','team-risk','adaptive-plan','club-audit','medical-summary','other'));

NOTIFY pgrst, 'reload schema';
