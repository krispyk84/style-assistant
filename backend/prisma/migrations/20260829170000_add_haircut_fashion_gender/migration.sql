-- AlterTable
ALTER TABLE "HaircutSession" ADD COLUMN "fashionGender" TEXT;

-- AlterTable
ALTER TABLE "HaircutTrendProfile" ADD COLUMN "fashionGender" TEXT NOT NULL DEFAULT 'menswear';
ALTER TABLE "HaircutTrendProfile" ALTER COLUMN "fashionGender" DROP DEFAULT;

-- Existing rows were generated with no gender constraint (a single unisex
-- list could surface women's styles in a menswear session, or vice versa) —
-- invalidate them so ensureCurrentProfile regenerates properly gender-scoped
-- profiles instead of serving stale mixed-gender data under an arbitrary
-- default gender.
UPDATE "HaircutTrendProfile" SET "status" = 'invalid' WHERE "status" = 'valid';

DROP INDEX "HaircutTrendProfile_season_year_hemisphere_key";
CREATE UNIQUE INDEX "HaircutTrendProfile_season_year_fashionGender_hemisphere_key" ON "HaircutTrendProfile"("season", "year", "fashionGender", "hemisphere");

DROP INDEX "HaircutTrendProfile_hemisphere_status_createdAt_idx";
CREATE INDEX "HaircutTrendProfile_fashionGender_hemisphere_status_createdAt_idx" ON "HaircutTrendProfile"("fashionGender", "hemisphere", "status", "createdAt" DESC);
