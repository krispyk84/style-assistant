-- Nullable, non-destructive: persists the OpenAI failure reason on a sketch row
-- instead of only the generic 'failed' status, so historical failures are
-- queryable without grepping ephemeral Render logs.
ALTER TABLE "TierResult" ADD COLUMN "sketchErrorCode" TEXT;
ALTER TABLE "TierResult" ADD COLUMN "sketchErrorMessage" TEXT;
ALTER TABLE "ClosetSketchJob" ADD COLUMN "sketchErrorCode" TEXT;
ALTER TABLE "ClosetSketchJob" ADD COLUMN "sketchErrorMessage" TEXT;
