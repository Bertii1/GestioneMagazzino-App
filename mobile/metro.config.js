const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Packages that ship TypeScript source (e.g. expo-file-system v18) must be
// transformed by Babel instead of being skipped as regular node_modules.
const defaultBlockList = config.transformer?.transformIgnorePatterns?.[0]
  ?? 'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?(/.*)?|react-navigation|@react-navigation/.*)';

config.transformer = {
  ...config.transformer,
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|expo(nent)?' +
      '|@expo(nent)?(/.*)?'  +
      '|expo-file-system' +
      '|expo-sharing' +
      '|react-navigation' +
      '|@react-navigation/.*' +
      '|react-native-svg' +
      '|react-native-qrcode-svg' +
      '|react-native-safe-area-context' +
      '|react-native-worklets' +
      '|react-native-reanimated' +
    '))',
  ],
};

module.exports = config;
