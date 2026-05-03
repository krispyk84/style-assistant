// Expo config plugin that injects `use_modular_headers!` into the generated
// Podfile. Required because @react-native-firebase pulls in Swift pods
// (FirebaseCoreInternal, FirebaseCrashlytics, FirebaseSessions) that depend
// on Objective-C pods (GoogleUtilities, GoogleDataTransport, nanopb) which
// don't define modules — pod install fails as a static-library build
// without modular headers. The Firebase Expo plugin doesn't inject this
// itself, so we do it here.
//
// This runs at every `expo prebuild` invocation, so any regenerated Podfile
// gets the fix applied automatically.

const { withPodfile } = require('@expo/config-plugins');

const MARKER = 'use_modular_headers!';

module.exports = function withModularHeaders(config) {
  return withPodfile(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      return cfg;
    }

    // Insert directly after `prepare_react_native_project!` so the directive
    // is global before any target block opens.
    const updated = contents.replace(
      /^prepare_react_native_project!$/m,
      `prepare_react_native_project!\n\n${MARKER}`,
    );

    if (updated === contents) {
      // Anchor not found — fail loudly rather than silently producing a
      // broken Podfile.
      throw new Error(
        '[with-modular-headers] Could not locate `prepare_react_native_project!` ' +
        'in the generated Podfile. The Expo template may have changed.',
      );
    }

    cfg.modResults.contents = updated;
    return cfg;
  });
};
