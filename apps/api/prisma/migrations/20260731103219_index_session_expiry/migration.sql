-- Every refresh leaves the rotated row behind as a reuse tripwire, so sessions grow by
-- roughly one row per access-token lifetime per signed-in tab and nothing ever removed
-- them. The hourly cleanup deletes rows past their expiry, and the whole rotation chain
-- shares one expires_at, so a chain leaves together. Without this index that sweep is a
-- seq scan over a table read on every refresh.

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
