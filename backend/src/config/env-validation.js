const DEFAULT_JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
const DEFAULT_REFRESH_TOKEN_SECRET = 'your-super-secret-refresh-token-key-change-this-in-production';
const PLACEHOLDER_SECRETS = new Set(['replace_me', 'changeme', 'change-me', '']);

const REQUIRED_VARS = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'DATABASE_URL', 'DIRECT_URL'];

function validateEnvOrThrow() {
  const missing = REQUIRED_VARS.filter((key) => !String(process.env[key] || '').trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. See backend/.env.example.`
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    return;
  }

  const jwtSecret = process.env.JWT_SECRET.trim();
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET.trim();

  if (jwtSecret === DEFAULT_JWT_SECRET || PLACEHOLDER_SECRETS.has(jwtSecret)) {
    throw new Error(
      'JWT_SECRET must be set to a strong unique value in production (default/placeholder secrets are not allowed).'
    );
  }

  if (refreshSecret === DEFAULT_REFRESH_TOKEN_SECRET || PLACEHOLDER_SECRETS.has(refreshSecret)) {
    throw new Error(
      'REFRESH_TOKEN_SECRET must be set to a strong unique value in production (default/placeholder secrets are not allowed).'
    );
  }

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  if (refreshSecret.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET must be at least 32 characters in production.');
  }
}

module.exports = {
  validateEnvOrThrow,
  DEFAULT_JWT_SECRET,
  DEFAULT_REFRESH_TOKEN_SECRET,
};
