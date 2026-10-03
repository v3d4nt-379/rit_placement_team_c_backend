const express = require('express');
const router = express.Router();

const AuditLog = require('../models/AuditLog');

router.get('/', async (req, res, next) => {
  try {
    const {
      applicationId,
      entityName,
      entityId,
      correlationId
    } = req.query;

    const filter = {};

    if (applicationId) {
      filter.entityId = applicationId;
      filter.entityName = 'application';
    }

    if (entityName) {
      filter.entityName = entityName;
    }

    if (entityId) {
      filter.entityId = entityId;
    }

    if (correlationId) {
      filter.correlationId =
        correlationId;
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(500);

    res.json({
      data: logs,
      meta: {
        count: logs.length,
        api_version: 'v1',
        correlation_id:
          req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;