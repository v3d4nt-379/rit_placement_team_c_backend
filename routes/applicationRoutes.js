const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Application = require('../models/Application');
const Student = require('../models/Student');
const Drive = require('../models/Drive');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');


// CREATE APPLICATION
router.post('/', async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      application_id,
      student_id,
      drive_id,
      resume_version,
      consent,
      idempotency_key
    } = req.body;

    if (
      !application_id ||
      !student_id ||
      !drive_id ||
      resume_version === undefined ||
      consent !== true ||
      !idempotency_key
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_APPLICATION_DATA',
          message:
            'application_id, student_id, drive_id, resume_version, consent=true and idempotency_key are required'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    let result;

    await session.withTransaction(async () => {
      const existingByKey = await Application.findOne({
        idempotencyKey: idempotency_key
      }).session(session);

      if (existingByKey) {
        result = {
          application: existingByKey,
          replay: true
        };
        return;
      }

      const student = await Student.findById(
        student_id
      ).session(session);

      if (!student) {
        const error = new Error('Student not found');
        error.statusCode = 404;
        error.code = 'STUDENT_NOT_FOUND';
        throw error;
      }

      const drive = await Drive.findById(
        drive_id
      ).session(session);

      if (!drive) {
        const error = new Error('Drive not found');
        error.statusCode = 404;
        error.code = 'DRIVE_NOT_FOUND';
        throw error;
      }

      if (drive.state !== 'ACTIVE') {
        const error = new Error(
          'Applications are closed for this drive'
        );
        error.statusCode = 409;
        error.code = 'DRIVE_NOT_ACTIVE';
        throw error;
      }

      const duplicate = await Application.findOne({
        studentId: student_id,
        driveId: drive_id
      }).session(session);

      if (duplicate) {
        const error = new Error(
          'Student has already applied for this drive'
        );
        error.statusCode = 409;
        error.code = 'DUPLICATE_APPLICATION';
        throw error;
      }

      const application = new Application({
        _id: application_id,
        studentId: student_id,
        driveId: drive_id,
        idempotencyKey: idempotency_key,
        state: 'APPLIED',
        version: 1
      });

      await application.save({ session });

      await AuditLog.create(
        [
          {
            _id: `AUD-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            correlationId: req.correlationId,
            actorId: req.headers['x-actor-id'],
            actorRole:
              req.headers['x-actor-role'] || 'STUDENT',
            action: 'APPLICATION_CREATED',
            entityName: 'application',
            entityId: application._id,
            sourceService: 'TEAM_C',
            beforeState: null,
            afterState: application.toObject()
          }
        ],
        { session }
      );

      await OutboxEvent.create(
        [
          {
            _id: `EVT-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            correlationId: req.correlationId,
            eventType: 'APPLICATION_CREATED',
            aggregateType: 'APPLICATION',
            aggregateId: application._id,
            payload: {
              application_id: application._id,
              student_id: student_id,
              drive_id: drive_id,
              state: application.state
            }
          }
        ],
        { session }
      );

      result = {
        application,
        replay: false
      };
    });

    return res.status(result.replay ? 200 : 201).json({
      data: {
        application_id: result.application._id,
        student_id: result.application.studentId,
        drive_id: result.application.driveId,
        state: result.application.state,
        version: result.application.version
      },
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId,
        idempotent_replay: result.replay
      }
    });
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    next(error);
  } finally {
    await session.endSession();
  }
});

// ========================================
// GET ALL APPLICATIONS
// ========================================

router.get('/', async (req, res, next) => {
  try {
    const applications = await Application.find();

    return res.status(200).json({
      data: applications,
      meta: {
        count: applications.length,
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET APPLICATION
router.get('/:applicationId', async (req, res, next) => {
  try {
    const application = await Application.findById(
      req.params.applicationId
    );

    if (!application) {
      return res.status(404).json({
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Application not found'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    const audits = await AuditLog.find({
      entityName: 'application',
      entityId: application._id
    }).sort({ timestamp: -1 });

    res.json({
      data: {
        application,
        audit_references: audits.map(
          audit => audit._id
        )
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


// WITHDRAW APPLICATION
router.post(
  '/:applicationId/withdraw',
  async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
      let updatedApplication;

      await session.withTransaction(async () => {
        const application = await Application.findById(
          req.params.applicationId
        ).session(session);

        if (!application) {
          const error = new Error(
            'Application not found'
          );
          error.statusCode = 404;
          error.code = 'APPLICATION_NOT_FOUND';
          throw error;
        }

        if (
          [
            'SELECTED',
            'OFFER_ISSUED',
            'WITHDRAWN'
          ].includes(application.state)
        ) {
          const error = new Error(
            'Application cannot be withdrawn at this stage'
          );
          error.statusCode = 409;
          error.code = 'WITHDRAWAL_NOT_ALLOWED';
          throw error;
        }

        const beforeState =
          application.toObject();

        application.state = 'WITHDRAWN';
        application.version += 1;

        await application.save({ session });

        await AuditLog.create(
          [
            {
              _id: `AUD-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
              correlationId:
                req.correlationId,
              actorId:
                req.headers['x-actor-id'],
              actorRole:
                req.headers['x-actor-role'] ||
                'STUDENT',
              action:
                'APPLICATION_WITHDRAWN',
              entityName:
                'application',
              entityId:
                application._id,
              sourceService:
                'TEAM_C',
              beforeState,
              afterState:
                application.toObject()
            }
          ],
          { session }
        );

        await OutboxEvent.create(
          [
            {
              _id: `EVT-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
              correlationId:
                req.correlationId,
              eventType:
                'APPLICATION_WITHDRAWN',
              aggregateType:
                'APPLICATION',
              aggregateId:
                application._id,
              payload: {
                application_id:
                  application._id,
                state:
                  application.state
              }
            }
          ],
          { session }
        );

        updatedApplication =
          application;
      });

      res.json({
        data: {
          application_id:
            updatedApplication._id,
          state:
            updatedApplication.state,
          version:
            updatedApplication.version
        },
        meta: {
          api_version: 'v1',
          correlation_id:
            req.correlationId
        }
      });
    } catch (error) {
      next(error);
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;