-- W9 Day 44: Coach reviews — athletes rate coaches 1..5 + optional comment.
-- One review per (athlete, coach) pair. Athletes can edit/delete their own.
-- Aggregate view feeds marketplace card rating badges.

CREATE TABLE IF NOT EXISTS coach_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating           smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_reviews_self_review_forbidden CHECK (coach_id != athlete_id),
  CONSTRAINT coach_reviews_unique_per_pair UNIQUE (coach_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS coach_reviews_coach_idx ON coach_reviews (coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coach_reviews_athlete_idx ON coach_reviews (athlete_id);

ALTER TABLE coach_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_reviews_read ON coach_reviews;
CREATE POLICY coach_reviews_read ON coach_reviews
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS coach_reviews_athlete_insert ON coach_reviews;
CREATE POLICY coach_reviews_athlete_insert ON coach_reviews
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = get_my_user_id() AND coach_id != get_my_user_id());

DROP POLICY IF EXISTS coach_reviews_athlete_update ON coach_reviews;
CREATE POLICY coach_reviews_athlete_update ON coach_reviews
  FOR UPDATE TO authenticated
  USING (athlete_id = get_my_user_id())
  WITH CHECK (athlete_id = get_my_user_id());

DROP POLICY IF EXISTS coach_reviews_athlete_delete ON coach_reviews;
CREATE POLICY coach_reviews_athlete_delete ON coach_reviews
  FOR DELETE TO authenticated
  USING (athlete_id = get_my_user_id());

CREATE OR REPLACE FUNCTION coach_reviews_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_reviews_updated_at ON coach_reviews;
CREATE TRIGGER coach_reviews_updated_at
  BEFORE UPDATE ON coach_reviews
  FOR EACH ROW EXECUTE FUNCTION coach_reviews_set_updated_at();

CREATE OR REPLACE VIEW coach_review_summary AS
  SELECT
    coach_id,
    COUNT(*)::int AS review_count,
    ROUND(AVG(rating)::numeric, 2)::float AS avg_rating
  FROM coach_reviews
  GROUP BY coach_id;

GRANT SELECT ON coach_review_summary TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
