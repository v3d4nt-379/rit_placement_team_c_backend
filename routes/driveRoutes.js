const express = require('express');
const router = express.Router();

const Drive = require('../models/Drive');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');

router.get('/', async (req, res, next) => {
  try {
    const drives = await Drive.find()
      .sort({ createdAt: -1 });

    res.json({
      data: drives,
      meta: {
        count: drives.length,
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:driveId', async (req, res, next) => {
  try {
    const drive = await Drive.findById(
      req.params.driveId
    );

    if (!drive) {
      return res.status(404).json({
        error: {
          code: 'DRIVE_NOT_FOUND',
          message: 'Drive not found'
        }
      });
    }

    res.json({
      data: drive,
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:driveId/criteria', async (req, res, next) => {
  try {
    const drive = await Drive.findById(
      req.params.driveId
    );

    if (!drive) {
      return res.status(404).json({
        error: {
          code: 'DRIVE_NOT_FOUND',
          message: 'Drive not found'
        }
      });
    }

    res.json({
      data: {
        drive_id: drive._id,
        company: drive.company,
        criteria: drive.ruleSet,
        seats: drive.seats ?? null,
        package: drive.package,
        state: drive.state,
        version: drive.version
      },
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});


// PATCH /internal/v1/drives/:driveId
router.patch('/:driveId', async (req, res, next) => {
  try {
    const drive = await Drive.findById(
      req.params.driveId
    );

    if (!drive) {
      return res.status(404).json({
        error: {
          code: 'DRIVE_NOT_FOUND',
          message: 'Drive not found'
        }
      });
    }

    const beforeState = drive.toObject();

    const allowedFields = [
      'company',
      'package',
      'ruleSet',
      'state'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        drive[field] = req.body[field];
      }
    }

    drive.version += 1;

    await drive.save();

    await AuditLog.create({
      _id: `AUD-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      correlationId: req.correlationId,
      actorId: req.headers['x-actor-id'],
      actorRole: req.headers['x-actor-role'] || 'TEAM_D_ADMIN',
      action: 'DRIVE_UPDATED',
      entityName: 'drive',
      entityId: drive._id,
      sourceService: 'TEAM_C',
      beforeState,
      afterState: drive.toObject()
    });

    await OutboxEvent.create({
      _id: `EVT-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      correlationId: req.correlationId,
      eventType: 'DRIVE_UPDATED',
      aggregateType: 'DRIVE',
      aggregateId: drive._id,
      payload: drive.toObject()
    });

    res.json({
      data: drive,
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;