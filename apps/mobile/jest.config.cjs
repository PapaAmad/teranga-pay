module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|react-navigation|react-native-safe-area-context|react-native-screens))',
  ],
};
