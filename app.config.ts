import type { ExpoConfig } from 'expo/config';

// Side-by-side build variants. Set APP_VARIANT=development to produce a
// Vesture Dev build that installs alongside the App Store / production
// build with its own bundle identifier and display name.
//
// Firebase + Apple Sign-In plugins stay active in both variants — their
// pods are pulled in by React Native autolinking either way, and the
// Firebase plugin is what injects `use_modular_headers!` into the
// Podfile so those pods compile. In the dev build Firebase fails to
// initialize at runtime (the `.dev` bundle id doesn't match the prod
// `GoogleService-Info.plist`); that's an accepted soft failure — no
// analytics in dev — until you register the `.dev` bundle id in your
// Firebase project and drop a `GoogleService-Info.dev.plist`.
const IS_DEV = process.env.APP_VARIANT === 'development';

const config: ExpoConfig = {
  name: IS_DEV ? 'Vesture Dev' : 'Vesture',
  slug: 'style-assistant',
  version: '0.0.6',
  platforms: ['ios'],
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: IS_DEV ? 'styleassistantdev' : 'styleassistant',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: IS_DEV
      ? 'com.krispyk84.styleassistant.dev'
      : 'com.krispyk84.styleassistant',
    supportsTablet: false,
    // Always reference the prod plist so the Firebase plugin can copy a
    // file into ios/Vesture/. In the dev variant the bundle id won't match
    // the plist's CLIENT_ID, so Firebase init logs a warning at startup
    // and analytics/crashlytics no-op — fine for a refactor test build.
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    buildNumber: '10',
  },
  plugins: [
    './plugins/with-modular-headers',
    './plugins/with-development-team',
    'expo-router',
    '@react-native-firebase/app',
    '@react-native-firebase/crashlytics',
    'expo-apple-authentication',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Vesture uses your location to show current weather and tailor seasonal outfit suggestions.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Vesture uses your photo library so you can upload anchor items, candidate pieces, and outfit selfies.',
        cameraPermission:
          'Vesture uses the camera so you can capture anchor items, candidate pieces, and outfit selfies.',
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission:
          'Vesture uses your calendar to schedule outfit events.',
        remindersPermission:
          'Vesture needs access to Reminders to export your packing list.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './logo.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FCFAF7',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '40fa7bfb-a09f-4a9f-983e-7e1a7f32976b',
    },
    // Surfaces the variant flag to JS via expo-constants if needed for
    // labelling, debug overlays, or analytics tagging in future work.
    appVariant: IS_DEV ? 'development' : 'production',
  },
};

export default config;
