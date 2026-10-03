const express = require('express');
const router = express.Router();

const Student = require('../models/Student');

router.get('/', async (req, res, next) => {
  try {
    const students = await Student.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      data: students,
      meta: {
        count: students.length,
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:studentId', async (req, res, next) => {
  try {
    const student = await Student.findById(
      req.params.studentId
    );

    if (!student) {
      return res.status(404).json({
        error: {
          code: 'STUDENT_NOT_FOUND',
          message: 'Student not found'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    res.json({
      data: student,
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      _id,
      name,
      email,
      branch,
      academic,
      skills = [],
      resumes = []
    } = req.body;

    if (
      !_id ||
      !name ||
      !email ||
      !branch ||
      !academic ||
      academic.cgpa === undefined ||
      academic.attendancePct === undefined ||
      academic.batch === undefined
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STUDENT_DATA',
          message: 'Required student fields are missing'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    const existing = await Student.findOne({
      $or: [
        { _id },
        { email }
      ]
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: 'STUDENT_ALREADY_EXISTS',
          message: 'Student ID or email already exists'
        },
        meta: {
          correlation_id: req.correlationId
        }
      });
    }

    const student = await Student.create({
      _id,
      name,
      email,
      branch,
      academic,
      skills,
      resumes
    });

    res.status(201).json({
      data: student,
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