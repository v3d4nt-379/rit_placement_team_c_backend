require('dotenv').config();

const express = require('express');
const crypto = require('crypto');

const connectDB = require('./config/db');

// Register models
require('./models/Student');
require('./models/Drive');
require('./models/Application');
require('./models/InterviewSlot');
require('./models/AuditLog');
require('./models/Offer');
require('./models/OutboxEvent');

const studentRoutes =
  require('./routes/studentRoutes');

const driveRoutes =
  require('./routes/driveRoutes');

const applicationRoutes =
  require('./routes/applicationRoutes');

const offerRoutes =
  require('./routes/offerRoutes');

const reportRoutes =
  require('./routes/reportRoutes');

const auditRoutes =
  require('./routes/auditRoutes');


const app = express();


// ==============================
// Middleware
// ==============================

app.use(express.json({
  limit: '1mb'
}));


// Correlation ID
app.use((req, res, next) => {
  const incoming =
    req.headers['x-correlation-id'];

  req.correlationId =
    incoming ||
    crypto.randomUUID();

  res.setHeader(
    'X-Correlation-ID',
    req.correlationId
  );

  next();
});


// ==============================
// Health
// ==============================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service:
      'Team C - Placement Data & Transaction Manager',
    timestamp:
      new Date().toISOString(),
    correlation_id:
      req.correlationId
  });
});


// ==============================
// Readiness
// ==============================

app.get('/ready', (req, res) => {
  const mongoose =
    require('mongoose');

  const ready =
    mongoose.connection.readyState === 1;

  res.status(ready ? 200 : 503).json({
    status:
      ready ? 'READY' : 'NOT_READY',
    database:
      ready ? 'CONNECTED' : 'DISCONNECTED',
    correlation_id:
      req.correlationId
  });
});


// ==============================
// Team C APIs
// ==============================

app.use(
  '/api/v1/students',
  studentRoutes
);

app.use(
  '/api/v1/drives',
  driveRoutes
);

app.use(
  '/api/v1/applications',
  applicationRoutes
);

app.use(
  '/internal/v1/offers',
  offerRoutes
);

app.use(
  '/api/v1/reports',
  reportRoutes
);

app.use(
  '/api/v1/audit',
  auditRoutes
);


// ==============================
// 404
// ==============================

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message:
        'API endpoint not found'
    },
    meta: {
      correlation_id:
        req.correlationId
    }
  });
});


// ==============================
// Global error handler
// ==============================

app.use(
  (err, req, res, next) => {
    console.error(
      `[${req.correlationId}]`,
      err
    );

    res.status(
      err.statusCode || 500
    ).json({
      error: {
        code:
          err.code ||
          'INTERNAL_SERVER_ERROR',
        message:
          err.message ||
          'Internal server error'
      },
      meta: {
        correlation_id:
          req.correlationId
      }
    });
  }
);


// ==============================
// Start server
// ==============================

const PORT =
  process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `Team C Server running on port ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      'Failed to start server:',
      error
    );

    process.exit(1);
  }
};

startServer();