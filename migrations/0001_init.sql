-- ftbl initial schema.
-- Matches and events are provider-agnostic projections: the poller owns every
-- write, and the API only reads.

CREATE TABLE IF NOT EXISTS matches (
  id             TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  season         TEXT NOT NULL,
  kickoff        TEXT NOT NULL,
  status         TEXT NOT NULL,
  minute         INTEGER NOT NULL DEFAULT 0,
  added_time     INTEGER NOT NULL DEFAULT 0,
  clock_display  TEXT NOT NULL DEFAULT '',
  clock_running  INTEGER NOT NULL DEFAULT 0,
  home_id        TEXT NOT NULL,
  home_name      TEXT NOT NULL,
  home_short     TEXT NOT NULL,
  home_crest     TEXT,
  away_id        TEXT NOT NULL,
  away_name      TEXT NOT NULL,
  away_short     TEXT NOT NULL,
  away_crest     TEXT,
  home_score     INTEGER NOT NULL DEFAULT 0,
  away_score     INTEGER NOT NULL DEFAULT 0,
  venue          TEXT,
  prob_home      REAL,
  prob_draw      REAL,
  prob_away      REAL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches (kickoff);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);

CREATE TABLE IF NOT EXISTS match_events (
  id          TEXT PRIMARY KEY,
  match_id    TEXT NOT NULL,
  external_id TEXT NOT NULL,
  type        TEXT NOT NULL,
  minute      INTEGER NOT NULL,
  added_time  INTEGER NOT NULL DEFAULT 0,
  sequence    INTEGER NOT NULL,
  side        TEXT,
  player      TEXT,
  assist      TEXT,
  detail      TEXT,
  score_home  INTEGER,
  score_away  INTEGER,
  created_at  TEXT NOT NULL,
  UNIQUE (match_id, external_id),
  FOREIGN KEY (match_id) REFERENCES matches (id)
);

CREATE INDEX IF NOT EXISTS idx_events_match ON match_events (match_id, sequence);

CREATE TABLE IF NOT EXISTS rooms (
  code       TEXT PRIMARY KEY,
  match_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (match_id) REFERENCES matches (id)
);
