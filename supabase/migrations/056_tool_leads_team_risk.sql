-- Sprint W4 Day 18 (PR #34) — расширяем enum tool_leads.source для team-risk lead magnet.
-- Migration 037 ввёл инструмент leads с CHECK на 4 source values
-- (acwr / overtraining / templates / other); добавляем 'team-risk'.
--
-- Применено через Supabase MCP 2026-05-09.

ALTER TABLE tool_leads DROP CONSTRAINT IF EXISTS tool_leads_source_check;

ALTER TABLE tool_leads
  ADD CONSTRAINT tool_leads_source_check
  CHECK (source IN ('acwr','overtraining','templates','team-risk','other'));

NOTIFY pgrst, 'reload schema';
