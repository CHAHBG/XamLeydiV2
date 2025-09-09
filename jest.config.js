module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  transformIgnorePatterns: [
    '/node_modules/(?!@?expo(-.*)?|react-native|@react-native|react-navigation)'
  ],
  moduleNameMapper: {
  '\\.(png|jpg|jpeg|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
  '^react-native$': '<rootDir>/tests/__mocks__/react-native.js',
  '^react-native-maps$': '<rootDir>/tests/__mocks__/react-native-maps.js',
  '^react-native-paper$': '<rootDir>/tests/__mocks__/react-native-paper.js',
  '^expo-modules-core$': '<rootDir>/tests/__mocks__/expo-modules-core.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
