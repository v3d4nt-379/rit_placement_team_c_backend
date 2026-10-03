const express = require('express');
const router = express.Router();

const Application = require('../models/Application');

router.get(
  '/placement-performance',
  async (req, res, next) => {
    try {
      const [
        total,
        applied,
        shortlisted,
        selected,
        offers,
        withdrawn,
        rejected
      ] = await Promise.all([
        Application.countDocuments(),

        Application.countDocuments({
          state: 'APPLIED'
        }),

        Application.countDocuments({
          state: 'SHORTLISTED'
        }),

        Application.countDocuments({
          state: 'SELECTED'
        }),

        Application.countDocuments({
          state: 'OFFER_ISSUED'
        }),

        Application.countDocuments({
          state: 'WITHDRAWN'
        }),

        Application.countDocuments({
          state: 'REJECTED'
        })
      ]);

      res.json({
        data: {
          total_applications: total,
          applied,
          shortlisted,
          selected,
          offers,
          withdrawn,
          rejected
        },
        meta: {
          api_version: 'v1',
          correlation_id:
            req.correlationId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;