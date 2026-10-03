const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Application = require('../models/Application');
const Drive = require('../models/Drive');
const Offer = require('../models/Offer');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');


// POST /internal/v1/offers/commit
router.post('/commit', async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      application_id,
      decision_id,
      lease_id,
      ranking_id,
      expected_application_version
    } = req.body;

    if (
      !application_id ||
      !decision_id ||
      !lease_id ||
      !ranking_id ||
      expected_application_version === undefined
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_OFFER_COMMIT_DATA',
          message:
            'application_id, decision_id, lease_id, ranking_id and expected_application_version are required'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    let committed;

    await session.withTransaction(async () => {
      const application =
        await Application.findById(
          application_id
        ).session(session);

      if (!application) {
        const error = new Error(
          'Application not found'
        );
        error.statusCode = 404;
        error.code =
          'APPLICATION_NOT_FOUND';
        throw error;
      }

      if (
        application.version !==
        expected_application_version
      ) {
        const error = new Error(
          'Application version conflict'
        );
        error.statusCode = 409;
        error.code =
          'APPLICATION_VERSION_CONFLICT';
        throw error;
      }

      const drive = await Drive.findById(
        application.driveId
      ).session(session);

      if (!drive) {
        const error = new Error(
          'Drive not found'
        );
        error.statusCode = 404;
        error.code = 'DRIVE_NOT_FOUND';
        throw error;
      }

      if (drive.seats <= 0) {
        const error = new Error(
          'No seats available'
        );
        error.statusCode = 409;
        error.code = 'NO_SEATS_AVAILABLE';
        throw error;
      }

      const existingOffer =
        await Offer.findOne({
          applicationId: application_id
        }).session(session);

      if (existingOffer) {
        committed = existingOffer;
        return;
      }

      const beforeState =
        application.toObject();

      // Consume one seat
      drive.seats -= 1;
      drive.version += 1;

      await drive.save({ session });

      application.rankingId =
        ranking_id;

      application.eligibility = {
        ...(application.eligibility || {}),
        decisionId: decision_id,
        leaseId: lease_id,
        result: 'ELIGIBLE'
      };

      application.state =
        'OFFER_ISSUED';

      application.rankingStatus =
        'READY';

      application.version += 1;

      await application.save({
        session
      });

      const offer = new Offer({
        _id: `OFF-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        applicationId:
          application._id,
        studentId:
          application.studentId,
        driveId:
          application.driveId,
        packageOffered:
          drive.package,
        status:
          'OFFER_ISSUED',
        decisionId:
          decision_id,
        leaseId:
          lease_id,
        rankingId:
          ranking_id
      });

      await offer.save({ session });

      await AuditLog.create(
        [
          {
            _id: `AUD-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            correlationId:
              req.correlationId,
            actorRole:
              req.headers['x-actor-role'] ||
              'TEAM_A_ORCHESTRATOR',
            action:
              'OFFER_COMMITTED',
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
              'OFFER_ISSUED',
            aggregateType:
              'APPLICATION',
            aggregateId:
              application._id,
            payload: {
              application_id:
                application._id,
              offer_id:
                offer._id,
              decision_id,
              ranking_id,
              state:
                application.state
            }
          }
        ],
        { session }
      );

      committed = offer;
    });

    res.status(200).json({
      data: {
        commit_status: 'COMMITTED',
        offer_id: committed._id
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
});


// POST /internal/v1/offers/compensate
router.post('/compensate', async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      application_id,
      reason
    } = req.body;

    if (!application_id || !reason) {
      return res.status(400).json({
        error: {
          code: 'INVALID_COMPENSATION_DATA',
          message:
            'application_id and reason are required'
        }
      });
    }

    let application;

    await session.withTransaction(async () => {
      application =
        await Application.findById(
          application_id
        ).session(session);

      if (!application) {
        const error = new Error(
          'Application not found'
        );
        error.statusCode = 404;
        error.code =
          'APPLICATION_NOT_FOUND';
        throw error;
      }

      const beforeState =
        application.toObject();

      application.state =
        'COMPENSATION_REQUIRED';

      application.version += 1;

      await application.save({
        session
      });

      await AuditLog.create(
        [
          {
            _id: `AUD-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            correlationId:
              req.correlationId,
            actorRole:
              req.headers['x-actor-role'] ||
              'TEAM_C',
            action:
              'COMPENSATION_REQUIRED',
            entityName:
              'application',
            entityId:
              application._id,
            sourceService:
              'TEAM_C',
            beforeState,
            afterState: {
              ...application.toObject(),
              reason
            }
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
              'COMPENSATION_REQUIRED',
            aggregateType:
              'APPLICATION',
            aggregateId:
              application._id,
            payload: {
              application_id:
                application._id,
              reason
            }
          }
        ],
        { session }
      );
    });

    res.json({
      data: {
        application_id:
          application._id,
        compensation_status:
          'RECORDED',
        state:
          application.state
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
});

module.exports = router;