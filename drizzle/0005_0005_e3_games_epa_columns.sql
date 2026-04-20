-- E3-15: rename E2-era `posteam_epa` / `defteam_epa` (which were always null)
-- to semantically-clear per-game offensive EPA columns. These get populated
-- by etl/transform/games_epa.py at the end of each per-season transaction,
-- computed as AVG(epa) over REG qualifying plays per team for the game.
--
-- Feeds the home-page Last-6-Games strip (E3-11), which needs an EPA
-- differential per cell. Review finding #5.

ALTER TABLE "games" RENAME COLUMN "posteam_epa" TO "home_offense_epa_per_play";
ALTER TABLE "games" RENAME COLUMN "defteam_epa" TO "away_offense_epa_per_play";
