#!/usr/bin/env node
/**
 * Bumps the patch segment of expo.version in app.json.
 *
 * Usage:
 *   node scripts/bump-patch.js          # reads/writes app.json in place
 *
 * app.json is the single source of truth for the semantic version.
 * The app reads it at runtime via Constants.expoConfig.version.
 * EAS autoIncrement (eas.json) handles the native build number separately.
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const raw = fs.readFileSync(appJsonPath, 'utf8');
const appJson = JSON.parse(raw);

const current = appJson.expo?.version;
if (!current) {
  console.error('ERROR: expo.version not found in app.json');
  process.exit(1);
}

const parts = current.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`ERROR: expo.version "${current}" is not a valid MAJOR.MINOR.PATCH string`);
  process.exit(1);
}

parts[2] += 1;
const next = parts.join('.');

appJson.expo.version = next;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
console.log(`Version bumped: ${current} → ${next}`);
