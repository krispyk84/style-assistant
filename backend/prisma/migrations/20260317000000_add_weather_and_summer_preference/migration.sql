ALTER TABLE "UserProfile"
ADD COLUMN "summerBottomPreference" TEXT NOT NULL DEFAULT 'prefer-trousers';

ALTER TABLE "OutfitRequest"
ADD COLUMN "weatherContext" JSONB;
