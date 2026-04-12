-- Migrate any stored inverted_triangle body type values to athletic (closest equivalent)
UPDATE "UserProfile" SET "bodyType" = 'athletic' WHERE "bodyType" = 'inverted_triangle';
