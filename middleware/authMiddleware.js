const crypto = require('crypto');

/**
 * Middleware to verify the shared callback token from Team A.
 * Protects POST /internal/v1/applications/:applicationId/eligibility.
 * Expected header: Authorization: Bearer <token>
 * Expected env var: TEAM_C_CALLBACK_TOKEN
 */
const verifyCallbackToken = (req, res, next) => {
  const expectedToken = process.env.TEAM_C_CALLBACK_TOKEN;

  // Fail closed if server-side token configuration is missing or empty
  if (!expectedToken || typeof expectedToken !== 'string' || expectedToken.trim() === '') {
    return res.status(500).json({
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Callback authentication is not configured on the server'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  const authHeader = req.headers['authorization'];

  // Missing Authorization header
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header is missing'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  // Malformed Authorization header
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Malformed authorization header. Expected format: Bearer <token>'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  const providedToken = parts[1];

  // Timing-safe comparison handling arbitrary/unequal token lengths
  const providedHash = crypto.createHash('sha256').update(providedToken).digest();
  const expectedHash = crypto.createHash('sha256').update(expectedToken).digest();

  if (!crypto.timingSafeEqual(providedHash, expectedHash)) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid callback token'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  next();
};

/**
 * Middleware to verify the shared callback token from Team B.
 * Protects POST /internal/v1/drive-rankings and GET /internal/v1/drives/:driveId/rankings.
 * Expected header: Authorization: Bearer <token>
 * Expected env var: TEAM_B_CALLBACK_TOKEN
 */
const verifyTeamBCallbackToken = (req, res, next) => {
  const expectedToken = process.env.TEAM_B_CALLBACK_TOKEN;

  // Fail closed if server-side token configuration is missing or empty
  if (!expectedToken || typeof expectedToken !== 'string' || expectedToken.trim() === '') {
    return res.status(500).json({
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Team B callback authentication is not configured on the server'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  const authHeader = req.headers['authorization'];

  // Missing Authorization header
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header is missing'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  // Malformed Authorization header
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Malformed authorization header. Expected format: Bearer <token>'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  const providedToken = parts[1];

  // Timing-safe comparison handling arbitrary/unequal token lengths
  const providedHash = crypto.createHash('sha256').update(providedToken).digest();
  const expectedHash = crypto.createHash('sha256').update(expectedToken).digest();

  if (!crypto.timingSafeEqual(providedHash, expectedHash)) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid callback token'
      },
      meta: {
        correlation_id: req.correlationId
      }
    });
  }

  next();
};

module.exports = {
  verifyCallbackToken,
  verifyTeamBCallbackToken
};

