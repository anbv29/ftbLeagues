-- Local demo data for working on the UI without a live matchday.
--
-- Run with: npm run db:demo
-- Remove with: npm run db:demo:clear
--
-- Everything is namespaced with `demo:` so a real poll can never collide with
-- it. Kickoffs are relative to the moment the seed runs, and the live match is
-- parked at 67 minutes so the room has a score, a clock and a feed to show.

DELETE FROM match_events WHERE match_id LIKE 'demo:%';
DELETE FROM rooms WHERE match_id LIKE 'demo:%';
DELETE FROM matches WHERE id LIKE 'demo:%';

INSERT INTO matches (
  id, competition_id, external_id, season, kickoff, status, minute, added_time,
  clock_display, clock_running, home_id, home_name, home_short, home_crest,
  away_id, away_name, away_short, away_crest, home_score, away_score, venue,
  updated_at, prob_home, prob_draw, prob_away
) VALUES
(
  'demo:eng.1:ars-liv', 'eng.1', 'demo-ars-liv',
  printf('%d-%02d', CAST(strftime('%Y','now') AS INTEGER) - (strftime('%m','now') < '07'), (CAST(strftime('%Y','now') AS INTEGER) - (strftime('%m','now') < '07') + 1) % 100),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-68 minutes'),
  'live', 67, 0, '67''', 1,
  'demo:ars', 'Arsenal', 'ARS', NULL,
  'demo:liv', 'Liverpool', 'LIV', NULL,
  2, 1, 'Emirates Stadium',
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0.62, 0.23, 0.15
),
(
  'demo:esp.1:sev-bet', 'esp.1', 'demo-sev-bet',
  printf('%d-%02d', CAST(strftime('%Y','now') AS INTEGER) - (strftime('%m','now') < '07'), (CAST(strftime('%Y','now') AS INTEGER) - (strftime('%m','now') < '07') + 1) % 100),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours'),
  'finished', 90, 0, 'FT', 0,
  'demo:sev', 'Sevilla', 'SEV', NULL,
  'demo:bet', 'Real Betis', 'BET', NULL,
  2, 2, 'Estadio Ramon Sanchez-Pizjuan',
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0.4, 0.3, 0.3
),
(
  'demo:ger.1:bvb-fcb', 'ger.1', 'demo-bvb-fcb',
  printf('%d-%02d', CAST(strftime('%Y','now') AS INTEGER) - (strftime('%m','now') < '07'), (CAST(strftime('%Y','now') AS INTEGER) - (strftime('%m','now') < '07') + 1) % 100),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+2 hours'),
  'scheduled', 0, 0, '', 0,
  'demo:bvb', 'Borussia Dortmund', 'BVB', NULL,
  'demo:fcb', 'Bayern Munich', 'FCB', NULL,
  0, 0, 'Signal Iduna Park',
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0.3, 0.27, 0.43
);

INSERT INTO match_events (
  id, match_id, external_id, type, minute, added_time, sequence, side, player,
  assist, detail, score_home, score_away, created_at
) VALUES
('demo:eng.1:ars-liv:kickoff', 'demo:eng.1:ars-liv', 'demo-kickoff', 'kickoff', 0, 0, 1, NULL, NULL, NULL, 'Kick-off', 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:goal-1', 'demo:eng.1:ars-liv', 'demo-goal-1', 'goal', 12, 0, 2, 'home', 'Bukayo Saka', 'Martin Odegaard', 'Right-footed finish', 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:goal-2', 'demo:eng.1:ars-liv', 'demo-goal-2', 'goal', 34, 0, 3, 'away', 'Mohamed Salah', NULL, 'Low drive', 1, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:yellow-1', 'demo:eng.1:ars-liv', 'demo-yellow-1', 'yellow_card', 41, 0, 4, 'away', 'Alexis Mac Allister', NULL, 'Late challenge', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:ht', 'demo:eng.1:ars-liv', 'demo-ht', 'halftime', 45, 0, 5, NULL, NULL, NULL, 'Half-time', 1, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:goal-3', 'demo:eng.1:ars-liv', 'demo-goal-3', 'goal', 55, 0, 6, 'home', 'Kai Havertz', 'Declan Rice', 'Header from a corner', 2, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:yellow-2', 'demo:eng.1:ars-liv', 'demo-yellow-2', 'yellow_card', 63, 0, 7, 'home', 'Declan Rice', NULL, 'Stopping a counter', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
('demo:eng.1:ars-liv:corner-1', 'demo:eng.1:ars-liv', 'demo-corner-1', 'corner', 66, 0, 8, 'home', NULL, NULL, 'Corner won', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- A room code makes the demo share flow testable without touching the UI.
INSERT INTO rooms (code, match_id, created_at)
VALUES ('FTBL22', 'demo:eng.1:ars-liv', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
