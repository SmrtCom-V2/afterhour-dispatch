export default {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/db/migrations/**',
    '!src/db/migrate.js',
    '!src/db/seed.js',
    '!src/index.js',
  ],
  coverageThreshold: {
    // Global floor set at the real baseline after this pass (see AFTERHOUR
    // test-coverage audit, Aug 2026) — 36 of 40 route files still have zero
    // route-level tests, so an 80% floor would fail immediately. Note: Jest
    // computes "global" over files NOT matched by any more-specific path key
    // below, so this number is lower than the whole-repo blended coverage
    // (~6.9%) shown in the text table — it excludes the 4 routes tested here.
    // Raise this incrementally as more routes get covered.
    global: {
      statements: 3,
      branches: 4,
      functions: 4,
      lines: 3,
    },
    // The 4 highest-risk routes covered in this pass (billing, incidents,
    // buildings, tenants) — floor set just under their actual coverage so
    // a real regression fails CI, not so new code is forced to hit 80%.
    './src/routes/billing.js': {
      statements: 40,
      branches: 30,
      functions: 55,
      lines: 40,
    },
    './src/routes/incidents.js': {
      statements: 35,
      branches: 20,
      functions: 45,
      lines: 35,
    },
    './src/routes/buildings.js': {
      statements: 30,
      branches: 8,
      functions: 50,
      lines: 30,
    },
    './src/routes/tenants.js': {
      statements: 40,
      branches: 30,
      functions: 80,
      lines: 40,
    },
  },
};
