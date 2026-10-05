const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Application = require('../models/Application');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');

// POST /internal/v1/applications/:applicationId/eligibility
router.post('/:applicationId/eligibility', async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      request_id,
      decision_id,
      result,
      rule_set_version,
      failed_rules,
      lease_id
    } = req.body;

    if (
      !request_id ||
      typeof request_id !== 'string' ||
      !decision_id ||
      typeof decision_id !== 'string' ||
      !result ||
      typeof result !== 'string' ||
      !rule_set_version ||
      typeof rule_set_version !== 'string' ||
      !Array.isArray(failed_rules) ||
      !failed_rules.every(r => typeof r === 'string') ||
      !lease_id ||
      typeof lease_id !== 'string'
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ELIGIBILITY_DATA',
          message: 'request_id, decision_id, result, rule_set_version, failed_rules (array of strings), and lease_id are required and must be valid types'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    if (!['ELIGIBLE', 'CONDITIONAL', 'NOT_ELIGIBLE'].includes(result)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ELIGIBILITY_RESULT',
          message: 'result must be one of ELIGIBLE, CONDITIONAL, NOT_ELIGIBLE'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    let updatedApplication;

    await session.withTransaction(async () => {
      const application = await Application.findById(
        req.params.applicationId
      ).session(session);

      if (!application) {
        const error = new Error('Application not found');
        error.statusCode = 404;
        error.code = 'APPLICATION_NOT_FOUND';
        throw error;
      }

      const beforeState = application.toObject();

      application.eligibility = {
        requestId: request_id,
        decisionId: decision_id,
        result: result,
        ruleSetVersion: rule_set_version,
        failedRules: failed_rules,
        leaseId: lease_id
      };

      application.version += 1;

      await application.save({ session });

      await AuditLog.create(
        [
          {
            _id: `AUD-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            correlationId: req.correlationId,
            actorRole: 'TEAM_A',
            action: 'ELIGIBILITY_UPDATED',
            entityName: 'application',
            entityId: application._id,
            sourceService: 'TEAM_C',
            beforeState,
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
            eventType: 'APPLICATION_ELIGIBILITY_UPDATED',
            aggregateType: 'APPLICATION',
            aggregateId: application._id,
            payload: {
              application_id: application._id,
              eligibility: application.eligibility,
              version: application.version
            }
          }
        ],
        { session }
      );

      updatedApplication = application;
    });

    res.status(200).json({
      data: {
        application_id: updatedApplication._id,
        eligibility: updatedApplication.eligibility,
        version: updatedApplication.version
      },
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

module.exports = router;
