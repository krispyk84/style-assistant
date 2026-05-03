// Expo config plugin that writes DEVELOPMENT_TEAM into every Xcode build
// configuration of the main app target. Required because `expo prebuild`
// generates a fresh project.pbxproj with no team set; xcodebuild then
// fails with "Signing for ... requires a development team."
//
// Set APPLE_TEAM_ID in the environment to override the default below
// (e.g. on a different developer's machine).

const { withXcodeProject } = require('@expo/config-plugins');

const DEFAULT_TEAM_ID = 'VG4V26U4L3';

module.exports = function withDevelopmentTeam(config) {
  const teamId = process.env.APPLE_TEAM_ID || DEFAULT_TEAM_ID;

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const block of Object.values(configurations)) {
      // pbxXCBuildConfigurationSection includes both real config objects and
      // _comment string entries — only the objects have buildSettings.
      if (block && typeof block === 'object' && block.buildSettings) {
        block.buildSettings.DEVELOPMENT_TEAM = teamId;
      }
    }

    return cfg;
  });
};
