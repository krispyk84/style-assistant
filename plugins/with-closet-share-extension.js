// ─────────────────────────────────────────────────────────────────────────────
// Expo config plugin — wires an iOS Share Extension target into the generated
// Xcode project. The extension accepts an image, writes it into an App Group
// container, and opens the main app via the custom URL scheme so the app can
// route into "Does this work in my closet?" with the shared image attached.
//
// What this plugin does on every `expo prebuild`:
//   1. Adds App Group entitlement to the main app (via withEntitlementsPlist).
//   2. Copies the Swift, Info.plist, and entitlements templates from
//      plugins/share-extension/ into ios/ShareExtension/, substituting
//      placeholders for the active variant (App Group id, URL scheme, name).
//   3. Adds a new "ShareExtension" PBXNativeTarget to the Xcode project,
//      with Sources / Frameworks / Resources build phases.
//   4. Adds an "Embed App Extensions" copy-files phase on the main app target
//      so the .appex is bundled into the .app.
//   5. Sets the build settings the extension needs on every configuration
//      (INFOPLIST_FILE, CODE_SIGN_ENTITLEMENTS, PRODUCT_BUNDLE_IDENTIFIER,
//      Swift version, deployment target, code-signing style, dev team).
//
// All five steps are idempotent so re-running prebuild does not produce
// duplicate targets / phases / settings.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const {
  withXcodeProject,
  withEntitlementsPlist,
  withDangerousMod,
} = require('@expo/config-plugins');

const TARGET_NAME = 'ShareExtension';
const DEFAULT_TEAM_ID = 'VG4V26U4L3';
const DEPLOYMENT_TARGET = '15.1';

function appGroupForBundle(bundleId) {
  return `group.${bundleId}`;
}

function resolveScheme(config) {
  if (Array.isArray(config.scheme)) return config.scheme[0];
  return config.scheme || 'styleassistant';
}

// ── Step 1: App Group entitlement on the main app ───────────────────────────

function withMainAppEntitlements(config, appGroupId) {
  return withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.security.application-groups';
    const current = Array.isArray(cfg.modResults[key]) ? cfg.modResults[key] : [];
    if (!current.includes(appGroupId)) {
      cfg.modResults[key] = [...current, appGroupId];
    }
    return cfg;
  });
}

// ── Step 2: Copy + substitute templates into ios/ShareExtension/ ────────────

function withShareExtensionFiles(config, params) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const extensionDir = path.join(platformRoot, TARGET_NAME);
      fs.mkdirSync(extensionDir, { recursive: true });

      const templateDir = path.join(__dirname, 'share-extension');
      const replacements = {
        APP_GROUP_IDENTIFIER: params.appGroupId,
        MAIN_APP_URL_SCHEME: params.scheme,
        DISPLAY_NAME: params.displayName,
      };

      function substitute(content) {
        return content.replace(/\{\{(\w+)\}\}/g, (_, key) =>
          Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key] : ''
        );
      }

      const files = ['ShareViewController.swift', 'Info.plist', 'ShareExtension.entitlements'];
      for (const file of files) {
        const src = path.join(templateDir, file);
        const dst = path.join(extensionDir, file);
        const content = fs.readFileSync(src, 'utf8');
        fs.writeFileSync(dst, substitute(content));
      }
      return cfg;
    },
  ]);
}

// ── Step 3 & 4 & 5: Add target, embed phase, build settings ─────────────────

function withShareExtensionTarget(config, params) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const fullBundleId = `${params.bundleId}.${TARGET_NAME}`;
    const mainTargetName = cfg.modRequest.projectName || params.fallbackMainTargetName;

    // Idempotent: skip if a target with this name already exists.
    const targetsSection = project.pbxNativeTargetSection();
    let existingTargetUuid = null;
    for (const [uuid, target] of Object.entries(targetsSection)) {
      if (uuid.endsWith('_comment')) continue;
      if (target && typeof target === 'object' && target.name === TARGET_NAME) {
        existingTargetUuid = uuid;
        break;
      }
    }
    if (existingTargetUuid) {
      // Re-apply build settings in case team id / scheme changed across prebuilds.
      const existingTarget = targetsSection[existingTargetUuid];
      applyTargetBuildSettings(project, existingTarget.buildConfigurationList, params, fullBundleId);
      return cfg;
    }

    // Create the target. xcode npm package's addTarget signature is
    // (name, type, subfolder, bundleId?). subfolder controls where Xcode
    // looks for the target's files relative to the project root.
    const newTarget = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, fullBundleId);

    // Add the three build phases (empty containers) the extension needs.
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', newTarget.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', newTarget.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', newTarget.uuid);

    // Create an empty group for the extension; attach to the project's main group.
    const pbxGroup = project.addPbxGroup([], TARGET_NAME, TARGET_NAME);
    const mainGroupKey = project.getFirstProject().firstProject.mainGroup;
    const mainGroup = project.hash.project.objects.PBXGroup[mainGroupKey];
    if (!mainGroup.children.some((c) => c.value === pbxGroup.uuid)) {
      mainGroup.children.push({ value: pbxGroup.uuid, comment: TARGET_NAME });
    }

    // Source file — added with target → also registered in the Sources build phase.
    project.addSourceFile(
      `${TARGET_NAME}/ShareViewController.swift`,
      { target: newTarget.uuid },
      pbxGroup.uuid
    );

    // Info.plist and the entitlements file are referenced via build settings,
    // not compiled, so they need a PBXFileReference + group membership but no
    // build phase. xcode npm's addFile handles exactly that case.
    project.addFile(`${TARGET_NAME}/Info.plist`, pbxGroup.uuid, {
      lastKnownFileType: 'text.plist.xml',
      defaultEncoding: 4,
    });
    project.addFile(`${TARGET_NAME}/${TARGET_NAME}.entitlements`, pbxGroup.uuid, {
      lastKnownFileType: 'text.plist.entitlements',
      defaultEncoding: 4,
    });

    // Embed the .appex into the main .app.
    addEmbedAppExtensionsPhase(project, newTarget.uuid, mainTargetName);

    // Per-configuration build settings (Debug + Release).
    applyTargetBuildSettings(project, newTarget.pbxNativeTarget.buildConfigurationList, params, fullBundleId);

    return cfg;
  });
}

function applyTargetBuildSettings(project, buildConfigurationListUuid, params, fullBundleId) {
  const configList = project.pbxXCConfigurationList()[buildConfigurationListUuid];
  if (!configList || !Array.isArray(configList.buildConfigurations)) return;

  const allConfigs = project.pbxXCBuildConfigurationSection();
  for (const ref of configList.buildConfigurations) {
    const block = allConfigs[ref.value];
    if (!block || typeof block !== 'object' || !block.buildSettings) continue;
    Object.assign(block.buildSettings, {
      INFOPLIST_FILE: `${TARGET_NAME}/Info.plist`,
      CODE_SIGN_ENTITLEMENTS: `${TARGET_NAME}/${TARGET_NAME}.entitlements`,
      PRODUCT_BUNDLE_IDENTIFIER: fullBundleId,
      IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      CODE_SIGN_STYLE: 'Automatic',
      DEVELOPMENT_TEAM: params.teamId,
      ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES: 'YES',
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: '""',
      SKIP_INSTALL: 'NO',
      CURRENT_PROJECT_VERSION: 1,
      MARKETING_VERSION: '1.0',
      DEBUG_INFORMATION_FORMAT:
        block.buildSettings.DEBUG_INFORMATION_FORMAT || 'dwarf-with-dsym',
      ENABLE_BITCODE: 'NO',
    });
  }
}

/**
 * Adds an "Embed App Extensions" PBXCopyFilesBuildPhase on the main app target,
 * with the new extension's .appex as a build file. Idempotent: skipped if the
 * main target already has an Embed App Extensions phase.
 */
function addEmbedAppExtensionsPhase(project, extensionTargetUuid, mainTargetName) {
  const targetsSection = project.pbxNativeTargetSection();
  let mainTargetUuid = null;
  for (const [uuid, target] of Object.entries(targetsSection)) {
    if (uuid.endsWith('_comment')) continue;
    if (
      target &&
      typeof target === 'object' &&
      target.name === mainTargetName &&
      target.productType === '"com.apple.product-type.application"'
    ) {
      mainTargetUuid = uuid;
      break;
    }
  }
  if (!mainTargetUuid) return;

  const mainTarget = targetsSection[mainTargetUuid];
  const copyFilesSection = project.hash.project.objects.PBXCopyFilesBuildPhase || {};

  // The xcode npm package's `addTarget('...', 'app_extension', ...)` already
  // creates a PBXCopyFilesBuildPhase on the main target with dstSubfolderSpec
  // = 13 (PlugIns) and adds the .appex to it. We reuse that phase rather than
  // create a duplicate, since two phases producing the same file is a fatal
  // Xcode build error ("multiple commands produce ...appex"). We rename the
  // phase to "Embed App Extensions" for clarity in Xcode's UI.
  for (const phaseRef of mainTarget.buildPhases || []) {
    const phase = copyFilesSection[phaseRef.value];
    if (!phase) continue;
    const isPluginsCopy =
      phase.dstSubfolderSpec === 13 || phase.dstSubfolderSpec === '13';
    const isEmbedNamed =
      phase.name === '"Embed App Extensions"' || phase.name === 'Embed App Extensions';
    if (isPluginsCopy || isEmbedNamed) {
      // Standardise the name + ATTRIBUTES on the build-file ref so the embedded
      // extension is signed on copy (Xcode's default when you add an extension
      // target via the UI).
      phase.name = '"Embed App Extensions"';
      ensureAppexBuildFileAttributes(project, phase, extensionTargetUuid);
      appendAppexToEmbedPhase(project, phase, extensionTargetUuid);
      return;
    }
  }

  // Fallback — if for some reason no phase was created automatically, build
  // one ourselves.
  const phase = project.addBuildPhase(
    [],
    'PBXCopyFilesBuildPhase',
    'Embed App Extensions',
    mainTargetUuid,
    'app_extension'
  );
  appendAppexToEmbedPhase(project, phase.buildPhase || phase, extensionTargetUuid);
}

/**
 * Marks every build-file ref in the given Embed phase that points to the
 * extension's productReference with the RemoveHeadersOnCopy attribute so
 * the .appex is treated as an embeddable bundle by Xcode.
 */
function ensureAppexBuildFileAttributes(project, phase, extensionTargetUuid) {
  const targetsSection = project.pbxNativeTargetSection();
  const target = targetsSection[extensionTargetUuid];
  if (!target || !target.productReference) return;
  const buildFiles = project.pbxBuildFileSection();
  for (const file of phase.files || []) {
    const bf = buildFiles[file.value];
    if (!bf || bf.fileRef !== target.productReference) continue;
    bf.settings = bf.settings || {};
    const attrs = bf.settings.ATTRIBUTES;
    if (!Array.isArray(attrs) || !attrs.includes('RemoveHeadersOnCopy')) {
      bf.settings.ATTRIBUTES = ['RemoveHeadersOnCopy'];
    }
    if (file.comment === `${TARGET_NAME}.appex in Copy Files`) {
      file.comment = `${TARGET_NAME}.appex in Embed App Extensions`;
    }
    if (buildFiles[`${file.value}_comment`] === `${TARGET_NAME}.appex in Copy Files`) {
      buildFiles[`${file.value}_comment`] = `${TARGET_NAME}.appex in Embed App Extensions`;
    }
  }
}

/**
 * Adds a build-file reference to the extension's .appex inside the given
 * Embed App Extensions phase. Idempotent: skipped if a reference for the
 * same target already exists.
 */
function appendAppexToEmbedPhase(project, phase, extensionTargetUuid) {
  const targetsSection = project.pbxNativeTargetSection();
  const target = targetsSection[extensionTargetUuid];
  if (!target || !target.productReference) return;
  const productReferenceUuid = target.productReference;

  for (const file of phase.files || []) {
    const buildFile = project.pbxBuildFileSection()[file.value];
    if (buildFile && buildFile.fileRef === productReferenceUuid) return;
  }

  const buildFileUuid = project.generateUuid();
  project.pbxBuildFileSection()[buildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: productReferenceUuid,
    fileRef_comment: `${TARGET_NAME}.appex`,
    settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
  };
  project.pbxBuildFileSection()[`${buildFileUuid}_comment`] = `${TARGET_NAME}.appex in Embed App Extensions`;

  phase.files = phase.files || [];
  phase.files.push({ value: buildFileUuid, comment: `${TARGET_NAME}.appex in Embed App Extensions` });
}

// ── Main plugin entry ───────────────────────────────────────────────────────

module.exports = function withClosetShareExtension(config) {
  const bundleId = config.ios && config.ios.bundleIdentifier;
  if (!bundleId) {
    throw new Error('[with-closet-share-extension] config.ios.bundleIdentifier is required.');
  }
  const scheme = resolveScheme(config);
  const displayName = config.name || 'Vesture';
  const appGroupId = appGroupForBundle(bundleId);
  const teamId = process.env.APPLE_TEAM_ID || DEFAULT_TEAM_ID;
  // Expo defaults the iOS project name to the cleaned `config.name`. We fall
  // back to that when modRequest.projectName isn't populated yet (it is at
  // mod-time, but the safety net keeps the plugin robust if Expo changes).
  const fallbackMainTargetName = (config.name || 'Vesture').replace(/\s+/g, '');

  let cfg = config;
  cfg = withMainAppEntitlements(cfg, appGroupId);
  cfg = withShareExtensionFiles(cfg, { appGroupId, scheme, displayName });
  cfg = withShareExtensionTarget(cfg, {
    appGroupId,
    scheme,
    displayName,
    bundleId,
    teamId,
    fallbackMainTargetName,
  });

  // Surface the App Group id + URL scheme to JS via expo-constants so the
  // main app reads the same identifiers the extension uses.
  cfg.extra = cfg.extra || {};
  cfg.extra.shareExtension = {
    appGroupIdentifier: appGroupId,
    urlScheme: scheme,
  };
  return cfg;
};
