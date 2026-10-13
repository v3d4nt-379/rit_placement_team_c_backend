const express = require('express');
const mongoose = require('mongoose');

const DriveRanking = require('../models/DriveRanking');
const Application = require('../models/Application');
const Drive = require('../models/Drive');
const Offer = require('../models/Offer');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');
const { verifyTeamBCallbackToken } = require('../middleware/authMiddleware');

const NON_RANKABLE_STATES = [
  'WITHDRAWN',
  'REJECTED',
  'NOT_ELIGIBLE',
  'EXPIRED',
  'COMPENSATION_REQUIRED',
  'OFFER_ISSUED'
];

/**
 * Compares an existing DriveRanking document with incoming body for exact logical payload equality.
 */
function isIdenticalPayload(existing, body) {
  if (existing.driveId !== body.driveId) return false;
  if (existing.algorithm !== body.algorithm) return false;
  if (existing.graphVersion !== body.graphVersion) return false;
  if (existing.tieBreakRule !== body.tieBreakRule) return false;
  if (existing.rankedCandidates.length !== body.rankedCandidates.length) return false;

  const candidateMap = new Map();
  for (const c of existing.rankedCandidates) {
    candidateMap.set(c.applicationId, c);
  }

  for (const c of body.rankedCandidates) {
    const ex = candidateMap.get(c.applicationId);
    if (!ex) return false;
    if (ex.studentId !== c.studentId) return false;
    if (ex.rank !== c.rank) return false;
    if (Number(ex.totalScore) !== Number(c.totalScore)) return false;
  }

  return true;
}

/**
 * Controller: Create or Replay a Drive Ranking Run
 * POST /internal/v1/drive-rankings
 */
const createDriveRanking = async (req, res, next) => {
  try {
    const {
      driveId,
      rankingId,
      algorithm,
      graphVersion,
      tieBreakRule,
      rankedCandidates
    } = req.body;

    // 1. Validate top-level required fields
    if (
      !driveId ||
      typeof driveId !== 'string' ||
      driveId.trim() === '' ||
      !rankingId ||
      typeof rankingId !== 'string' ||
      rankingId.trim() === '' ||
      !algorithm ||
      typeof algorithm !== 'string' ||
      algorithm.trim() === '' ||
      !graphVersion ||
      typeof graphVersion !== 'string' ||
      graphVersion.trim() === '' ||
      !tieBreakRule ||
      typeof tieBreakRule !== 'string' ||
      tieBreakRule.trim() === '' ||
      !Array.isArray(rankedCandidates) ||
      rankedCandidates.length === 0
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_RANKING_DATA',
          message: 'driveId, rankingId, algorithm, graphVersion, tieBreakRule and non-empty rankedCandidates array are required'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    // 2. Validate individual candidate items
    const rankSet = new Set();
    const studentSet = new Set();
    const appSet = new Set();

    for (const c of rankedCandidates) {
      if (
        !c ||
        typeof c !== 'object' ||
        !c.studentId ||
        typeof c.studentId !== 'string' ||
        c.studentId.trim() === '' ||
        !c.applicationId ||
        typeof c.applicationId !== 'string' ||
        c.applicationId.trim() === '' ||
        typeof c.rank !== 'number' ||
        !Number.isInteger(c.rank) ||
        c.rank < 1 ||
        typeof c.totalScore !== 'number' ||
        !Number.isFinite(c.totalScore)
      ) {
        return res.status(400).json({
          error: {
            code: 'INVALID_CANDIDATE_DATA',
            message: 'Every candidate must contain studentId, applicationId, positive integer rank, and finite totalScore'
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }

      if (rankSet.has(c.rank)) {
        return res.status(400).json({
          error: {
            code: 'DUPLICATE_RANK_FOUND',
            message: `Duplicate rank ${c.rank} found in rankedCandidates`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }
      rankSet.add(c.rank);

      if (studentSet.has(c.studentId)) {
        return res.status(400).json({
          error: {
            code: 'DUPLICATE_STUDENT_FOUND',
            message: `Duplicate studentId ${c.studentId} found in rankedCandidates`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }
      studentSet.add(c.studentId);

      if (appSet.has(c.applicationId)) {
        return res.status(400).json({
          error: {
            code: 'DUPLICATE_APPLICATION_FOUND',
            message: `Duplicate applicationId ${c.applicationId} found in rankedCandidates`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }
      appSet.add(c.applicationId);
    }

    // 3. Idempotency & Duplicate Submission check
    const existingRanking = await DriveRanking.findOne({ rankingId });
    if (existingRanking) {
      if (isIdenticalPayload(existingRanking, req.body)) {
        return res.status(200).json({
          data: existingRanking,
          meta: {
            api_version: 'v1',
            correlation_id: req.correlationId,
            idempotent_replay: true
          }
        });
      }

      return res.status(409).json({
        error: {
          code: 'RANKING_ID_CONFLICT',
          message: 'A ranking with this rankingId already exists with a different payload'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    // 4. Verify Drive existence
    const drive = await Drive.findById(driveId);
    if (!drive) {
      return res.status(404).json({
        error: {
          code: 'DRIVE_NOT_FOUND',
          message: 'Drive not found'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    // 5. Pre-check: Verify no existing active offers in drive or candidate applications
    const activeOffer = await Offer.findOne({
      $or: [
        { driveId },
        { applicationId: { $in: Array.from(appSet) } }
      ],
      status: { $in: ['OFFER_ISSUED', 'ACCEPTED'] }
    });
    const appWithOffer = await Application.findOne({
      $or: [
        { driveId, state: 'OFFER_ISSUED' },
        { _id: { $in: Array.from(appSet) }, state: 'OFFER_ISSUED' }
      ]
    });

    if (activeOffer || appWithOffer) {
      return res.status(409).json({
        error: {
          code: 'OFFER_ALREADY_ISSUED',
          message: 'Cannot submit or recalculate rankings: an offer has already been issued for this drive'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    // 6. Verify Applications existence, ownership, and lifecycle states
    const appIds = Array.from(appSet);
    const applications = await Application.find({ _id: { $in: appIds } });
    const appMap = new Map(applications.map(a => [a._id, a]));

    for (const c of rankedCandidates) {
      const app = appMap.get(c.applicationId);
      if (!app) {
        return res.status(404).json({
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: `Application ${c.applicationId} not found`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }

      if (app.driveId !== driveId) {
        return res.status(400).json({
          error: {
            code: 'APPLICATION_DRIVE_MISMATCH',
            message: `Application ${c.applicationId} does not belong to drive ${driveId}`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }

      if (app.studentId !== c.studentId) {
        return res.status(400).json({
          error: {
            code: 'APPLICATION_STUDENT_MISMATCH',
            message: `Application ${c.applicationId} does not belong to student ${c.studentId}`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }

      if (NON_RANKABLE_STATES.includes(app.state)) {
        return res.status(409).json({
          error: {
            code: 'APPLICATION_NOT_RANKABLE',
            message: `Application ${app._id} is in non-rankable state: ${app.state}`
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }
    }

    // 7. Atomic transaction for snapshot persistence and application updates
    const session = await mongoose.startSession();
    let savedRanking;

    try {
      await session.withTransaction(async () => {
        // Re-check inside transaction to avoid race conditions
        const activeOfferInTx = await Offer.findOne({
          $or: [
            { driveId },
            { applicationId: { $in: Array.from(appSet) } }
          ],
          status: { $in: ['OFFER_ISSUED', 'ACCEPTED'] }
        }).session(session);

        const appWithOfferInTx = await Application.findOne({
          $or: [
            { driveId, state: 'OFFER_ISSUED' },
            { _id: { $in: Array.from(appSet) }, state: 'OFFER_ISSUED' }
          ]
        }).session(session);

        if (activeOfferInTx || appWithOfferInTx) {
          const err = new Error('Cannot submit or recalculate rankings: an offer has already been issued for this drive');
          err.statusCode = 409;
          err.code = 'OFFER_ALREADY_ISSUED';
          throw err;
        }

        // Concurrent submission check
        const rankingConflict = await DriveRanking.findOne({ rankingId }).session(session);
        if (rankingConflict) {
          const err = new Error('A ranking with this rankingId already exists');
          err.statusCode = 409;
          err.code = 'RANKING_ID_CONFLICT';
          throw err;
        }

        // Find previous latest run for audit logging
        const previousLatest = await DriveRanking.findOne({ driveId, isLatest: true }).session(session);

        // Demote existing runs for this drive atomically
        await DriveRanking.updateMany(
          { driveId, isLatest: true },
          { $set: { isLatest: false } }
        ).session(session);

        // Create new immutable ranking snapshot
        const newRanking = new DriveRanking({
          driveId,
          rankingId,
          algorithm,
          graphVersion,
          tieBreakRule,
          rankedCandidates,
          isLatest: true
        });

        await newRanking.save({ session });

        // Update each relevant application
        for (const c of rankedCandidates) {
          const appToUpdate = await Application.findById(c.applicationId).session(session);
          if (!appToUpdate) {
            const err = new Error(`Application ${c.applicationId} not found during transaction`);
            err.statusCode = 404;
            err.code = 'APPLICATION_NOT_FOUND';
            throw err;
          }

          appToUpdate.rankingId = rankingId;
          appToUpdate.rankingStatus = 'READY';
          appToUpdate.version += 1;

          await appToUpdate.save({ session });
        }

        // Create AuditLog entry
        await AuditLog.create(
          [
            {
              _id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              correlationId: req.correlationId,
              actorId: 'TEAM_B',
              actorRole: 'TEAM_B_ENGINE',
              action: 'RANKING_COMPLETED',
              entityName: 'drive',
              entityId: driveId,
              sourceService: 'TEAM_B',
              beforeState: {
                latestRankingId: previousLatest ? previousLatest.rankingId : null
              },
              afterState: {
                rankingId,
                candidateCount: rankedCandidates.length,
                algorithm,
                graphVersion
              }
            }
          ],
          { session }
        );

        // Create OutboxEvent entry
        await OutboxEvent.create(
          [
            {
              _id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              correlationId: req.correlationId,
              eventType: 'DRIVE_RANKING_COMPLETED',
              aggregateType: 'DRIVE',
              aggregateId: driveId,
              payload: {
                drive_id: driveId,
                ranking_id: rankingId,
                candidate_count: rankedCandidates.length,
                algorithm,
                graph_version: graphVersion
              }
            }
          ],
          { session }
        );

        savedRanking = newRanking;
      });

      return res.status(201).json({
        data: savedRanking,
        meta: {
          api_version: 'v1',
          correlation_id: req.correlationId,
          idempotent_replay: false
        }
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.rankingId) {
        return res.status(409).json({
          error: {
            code: 'RANKING_ID_CONFLICT',
            message: 'A ranking with this rankingId already exists'
          },
          meta: {
            correlation_id: req.correlationId
          }
        });
      }
      return res.status(409).json({
        error: {
          code: 'CONCURRENT_RANKING_CONFLICT',
          message: 'A concurrent ranking submission was detected for this drive. Please retry.'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }
    next(error);
  }
};

/**
 * Controller: Get Ranking Runs for a Drive
 * GET /internal/v1/drives/:driveId/rankings
 */
const getDriveRankings = async (req, res, next) => {
  try {
    const { driveId } = req.params;

    const drive = await Drive.findById(driveId);
    if (!drive) {
      return res.status(404).json({
        error: {
          code: 'DRIVE_NOT_FOUND',
          message: 'Drive not found'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    const rankings = await DriveRanking.find({ driveId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      data: rankings,
      meta: {
        count: rankings.length,
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
};

// Router for POST /internal/v1/drive-rankings
const rankingRouter = express.Router();
rankingRouter.post('/', verifyTeamBCallbackToken, createDriveRanking);
rankingRouter.get('/:driveId', verifyTeamBCallbackToken, getDriveRankings);

// Router for GET /internal/v1/drives/:driveId/rankings
const driveRankingsRouter = express.Router();
driveRankingsRouter.get('/:driveId/rankings', verifyTeamBCallbackToken, getDriveRankings);

// Support both styles of imports
rankingRouter.rankingRouter = rankingRouter;
rankingRouter.driveRankingsRouter = driveRankingsRouter;

module.exports = rankingRouter;
