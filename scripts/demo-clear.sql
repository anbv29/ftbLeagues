-- Remove everything created by scripts/demo.sql.

DELETE FROM match_events WHERE match_id LIKE 'demo:%';
DELETE FROM rooms WHERE match_id LIKE 'demo:%' OR code = 'FTBL22';
DELETE FROM matches WHERE id LIKE 'demo:%';
