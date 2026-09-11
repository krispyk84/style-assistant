import Constants from 'expo-constants';

// Phase 3B2 (sync rollout gate) — the single source of truth for the app's
// marketing version and native build number, read once at module load.
// app.json's expo.version is already the established canonical version
// source (app/(app)/useSettings.ts's `appVersion` display constant reads
// the exact same Constants.expoConfig?.version); this module exists so the
// HTTP layer (X-App-Version/X-App-Build headers) and any future consumer
// read from the same place instead of each hardcoding their own access to
// Constants.expoConfig.
export const APP_VERSION: string = Constants.expoConfig?.version ?? 'unknown';

// ios.buildNumber in app.json/app.config.ts — the native build identifier
// (bumped per TestFlight/App Store submission, independent of the semantic
// version). 'unknown' on a config shape that omits it (e.g. a bare Expo Go
// dev session with no ios.buildNumber configured) rather than throwing —
// version telemetry degrading to 'unknown' is acceptable; breaking the app
// over a missing label is not.
export const APP_BUILD: string = String(Constants.expoConfig?.ios?.buildNumber ?? 'unknown');

/** Headers every authenticated backend request carries — see lib/api/api-client.ts. */
export function appVersionHeaders(): Record<string, string> {
  return { 'X-App-Version': APP_VERSION, 'X-App-Build': APP_BUILD };
}
