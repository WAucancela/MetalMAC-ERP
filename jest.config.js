/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    // jsx: 'preserve' en tsconfig.json asume que el bundler de Next.js transforma el
    // JSX — ts-jest compila con tsc puro, así que necesita su propio jsx real
    // (react-jsx) solo para los tests, sin tocar el tsconfig principal del build.
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { ...require('./tsconfig.json').compilerOptions, jsx: 'react-jsx' },
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
