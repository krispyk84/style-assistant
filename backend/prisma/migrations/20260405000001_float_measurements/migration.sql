-- AlterTable: change heightCm and weightKg from integer to double precision
-- so lbs→kg round-trip conversions stay lossless.
ALTER TABLE "UserProfile" ALTER COLUMN "heightCm" TYPE DOUBLE PRECISION USING "heightCm"::DOUBLE PRECISION;
ALTER TABLE "UserProfile" ALTER COLUMN "weightKg" TYPE DOUBLE PRECISION USING "weightKg"::DOUBLE PRECISION;
