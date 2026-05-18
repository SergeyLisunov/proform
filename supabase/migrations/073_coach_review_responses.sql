-- W10 Day 48: Coach responses to reviews — close the feedback loop.
--
-- Decision: column-on-coach_reviews (not separate table). 1:1 with review,
-- no history needed for MVP. If we ever support multi-reply or moderation,
-- ALTER to a separate `coach_review_replies` table.
--
-- Visibility: response is public (anyone who can read the review can read
-- the response). Write: only the coach being reviewed.

ALTER TABLE coach_reviews
  ADD COLUMN IF NOT EXISTS coach_response     TEXT,
  ADD COLUMN IF NOT EXISTS coach_response_at  TIMESTAMPTZ;

-- New RLS policy: coach (subject of the review) can UPDATE only their
-- own response fields. Athletes already had update-own-review policy;
-- this adds the orthogonal coach-side capability.
DROP POLICY IF EXISTS coach_reviews_coach_update_response ON coach_reviews;
CREATE POLICY coach_reviews_coach_update_response ON coach_reviews
  FOR UPDATE TO authenticated
  USING (coach_id = get_my_user_id())
  WITH CHECK (coach_id = get_my_user_id());

-- updated_at trigger from 071 still applies.

NOTIFY pgrst, 'reload schema';
