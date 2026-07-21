/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^firebase/firestore$': '<rootDir>/__mocks__/firebase/firestore.js',
    '^firebase/app$': '<rootDir>/__mocks__/firebase.js',
    '^firebase/auth$': '<rootDir>/__mocks__/firebase/auth.js',
    '^firebase/storage$': '<rootDir>/__mocks__/firebase/storage.js',
    '^firebase-admin/firestore$': '<rootDir>/__mocks__/firebase-admin-firestore.js',
    '^firebase-admin/auth$': '<rootDir>/__mocks__/firebase-client.js',
    '^firebase-admin/storage$': '<rootDir>/__mocks__/firebase-client.js',
  },
};
