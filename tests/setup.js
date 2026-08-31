// Runs once before the whole test run. src/lib/auth.js reads JWT_SECRET at import time,
// so this has to be set before any test file imports a route that touches auth.js —
// without it, jsonwebtoken throws "secretOrPrivateKey must have a value" and that error
// gets silently caught by withErrorHandling, turning into a misleading 500 instead of a
// clear test failure. Better to set it here once than repeat it in every test file.
process.env.JWT_SECRET = "test-secret-not-for-production";
