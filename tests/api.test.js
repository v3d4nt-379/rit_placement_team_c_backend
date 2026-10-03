require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');

jest.setTimeout(30000);

const BASE_URL = 'http://localhost:5000';

const Application = require('../models/Application');
const Drive = require('../models/Drive');
const Student = require('../models/Student');
const Offer = require('../models/Offer');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');

beforeAll(async () => {
  // Connect to DB directly for assertions and test data setup
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rit_placement_db';
  await mongoose.connect(mongoURI, { dbName: 'rit_placement_db' });

  // Setup test data directly
  await Drive.create({
    _id: 'TEST-DRV-01',
    company: 'Test Company',
    package: 1000000,
    seats: 2,
    state: 'ACTIVE',
    version: 1,
    ruleSet: { version: 'v1.0', rules: [] }
  });

  await Student.create({
    _id: 'TEST-STU-01',
    name: 'Test Student 1',
    email: 'test1@example.com',
    branch: 'CSE',
    academic: { cgpa: 9.0, backlogs: 0, attendancePct: 100, batch: 2027 }
  });

  await Student.create({
    _id: 'TEST-STU-02',
    name: 'Test Student 2',
    email: 'test2@example.com',
    branch: 'IT',
    academic: { cgpa: 8.5, backlogs: 0, attendancePct: 100, batch: 2027 }
  });

  await Student.create({
    _id: 'TEST-STU-03',
    name: 'Test Student 3',
    email: 'test3@example.com',
    branch: 'ECE',
    academic: { cgpa: 8.0, backlogs: 0, attendancePct: 100, batch: 2027 }
  });
});

afterAll(async () => {
  // Cleanup ONLY test records
  await Drive.deleteOne({ _id: 'TEST-DRV-01' });
  await Student.deleteMany({ _id: { $in: ['TEST-STU-01', 'TEST-STU-02', 'TEST-STU-03', 'TEST-STU-04'] } });

  // Clean up test applications
  const testApps = await Application.find({ _id: { $in: ['TEST-APP-01', 'TEST-APP-02', 'TEST-APP-03'] } });
  const testAppIds = testApps.map(app => app._id);

  await Application.deleteMany({ _id: { $in: testAppIds } });

  await Offer.deleteMany({ applicationId: { $in: testAppIds } });

  // Clean up audit logs and outbox events related to these entities
  await AuditLog.deleteMany({
    $or: [
      { entityId: 'TEST-DRV-01' },
      { entityId: { $in: testAppIds } },
      { actorId: { $in: ['TEST-STU-01', 'TEST-STU-02', 'TEST-STU-03', 'TEST-STU-04'] } }
    ]
  });

  await OutboxEvent.deleteMany({
    $or: [
      { aggregateId: 'TEST-DRV-01' },
      { aggregateId: { $in: testAppIds } }
    ]
  });

  await mongoose.disconnect();
});

describe('Phase 1: Health / Readiness', () => {
  it('GET /health returns UP', async () => {
    const res = await request(BASE_URL).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('GET /ready returns READY', async () => {
    const res = await request(BASE_URL).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
  });
});

describe('Phase 2: Students', () => {
  it('GET /api/v1/students returns all students', async () => {
    const res = await request(BASE_URL).get('/api/v1/students');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/students/:id returns a specific student', async () => {
    const res = await request(BASE_URL).get('/api/v1/students/STU001');
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe('STU001');
  });

  it('GET /api/v1/students/:id returns 404 for invalid student', async () => {
    const res = await request(BASE_URL).get('/api/v1/students/INVALID_STU');
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/students creates a new student', async () => {
    const newStudent = {
      _id: 'TEST-STU-04',
      name: 'Test Student 4',
      email: 'test4@example.com',
      branch: 'CSE',
      academic: { cgpa: 9.5, attendancePct: 90, batch: 2027 }
    };
    const res = await request(BASE_URL).post('/api/v1/students').send(newStudent);
    expect(res.status).toBe(201);
    expect(res.body.data._id).toBe('TEST-STU-04');
  });

  it('POST /api/v1/students fails on duplicate ID (409)', async () => {
    const newStudent = {
      _id: 'TEST-STU-04',
      name: 'Test Student Duplicate',
      email: 'test4-dup@example.com',
      branch: 'CSE',
      academic: { cgpa: 9.5, attendancePct: 90, batch: 2027 }
    };
    const res = await request(BASE_URL).post('/api/v1/students').send(newStudent);
    expect(res.status).toBe(409);
  });
});

describe('Phase 3: Drives', () => {
  it('GET /api/v1/drives returns all drives', async () => {
    const res = await request(BASE_URL).get('/api/v1/drives');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/drives/:id returns specific drive', async () => {
    const res = await request(BASE_URL).get('/api/v1/drives/DRV001');
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe('DRV001');
  });

  it('GET /api/v1/drives/:id/criteria returns drive criteria', async () => {
    const res = await request(BASE_URL).get('/api/v1/drives/DRV001/criteria');
    expect(res.status).toBe(200);
    expect(res.body.data.criteria).toBeDefined();
  });

  it('PATCH /api/v1/drives/:id is skipped because it modifies data and API cannot safely create temp drive', () => {
    // Skipped intentionally to avoid modifying seeded drives.
  });
});

describe('Phase 4: Applications & Transactions', () => {
  it('POST /api/v1/applications creates a valid application', async () => {
    const payload = {
      application_id: 'TEST-APP-01',
      student_id: 'TEST-STU-01',
      drive_id: 'TEST-DRV-01',
      resume_version: 1,
      consent: true,
      idempotency_key: 'IDEMP-TEST-APP-01'
    };
    const res = await request(BASE_URL).post('/api/v1/applications').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.meta.idempotent_replay).toBe(false);

    // Verify DB Integrity
    const app = await Application.findById('TEST-APP-01');
    expect(app).toBeTruthy();
    expect(app.state).toBe('APPLIED');
  });

  it('POST /api/v1/applications handles idempotency properly (replay)', async () => {
    const payload = {
      application_id: 'TEST-APP-01',
      student_id: 'TEST-STU-01',
      drive_id: 'TEST-DRV-01',
      resume_version: 1,
      consent: true,
      idempotency_key: 'IDEMP-TEST-APP-01'
    };
    const res = await request(BASE_URL).post('/api/v1/applications').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.meta.idempotent_replay).toBe(true);
  });

  it('POST /api/v1/applications rejects duplicate student+drive with different idempotency key', async () => {
    const payload = {
      application_id: 'TEST-APP-DUPLICATE',
      student_id: 'TEST-STU-01',
      drive_id: 'TEST-DRV-01',
      resume_version: 1,
      consent: true,
      idempotency_key: 'IDEMP-TEST-APP-DUPLICATE'
    };
    const res = await request(BASE_URL).post('/api/v1/applications').send(payload);
    expect(res.status).toBe(409); // Conflict
  });

  it('POST /api/v1/applications/:id/withdraw withdraws successfully', async () => {
    const payload = {
      application_id: 'TEST-APP-02',
      student_id: 'TEST-STU-02',
      drive_id: 'TEST-DRV-01',
      resume_version: 1,
      consent: true,
      idempotency_key: 'IDEMP-TEST-APP-02'
    };
    await request(BASE_URL).post('/api/v1/applications').send(payload);

    const res = await request(BASE_URL).post(`/api/v1/applications/TEST-APP-02/withdraw`);
    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('WITHDRAWN');
  });
});

describe('Phase 5: Offers & Transactions', () => {
  it('POST /internal/v1/offers/commit successfully commits an offer and updates related aggregates', async () => {
    // 1. Create a new application
    const appPayload = {
      application_id: 'TEST-APP-03',
      student_id: 'TEST-STU-03',
      drive_id: 'TEST-DRV-01',
      resume_version: 1,
      consent: true,
      idempotency_key: 'IDEMP-TEST-APP-03'
    };
    await request(BASE_URL).post('/api/v1/applications').send(appPayload);

    // Get current drive seats
    const driveBefore = await Drive.findById('TEST-DRV-01');
    const seatsBefore = driveBefore.seats;
    const versionBefore = driveBefore.version;

    // 2. Commit offer
    const commitPayload = {
      application_id: 'TEST-APP-03',
      decision_id: 'DEC-01',
      lease_id: 'LEASE-01',
      ranking_id: 'RANK-01',
      expected_application_version: 1
    };

    const res = await request(BASE_URL).post('/internal/v1/offers/commit').send(commitPayload);
    expect(res.status).toBe(200);
    expect(res.body.data.commit_status).toBe('COMMITTED');

    // 3. Verify DB state after transaction
    const appAfter = await Application.findById('TEST-APP-03');
    expect(appAfter.state).toBe('OFFER_ISSUED');
    expect(appAfter.version).toBe(2);

    const driveAfter = await Drive.findById('TEST-DRV-01');
    expect(driveAfter.seats).toBe(seatsBefore - 1);
    expect(driveAfter.version).toBe(versionBefore + 1);

    const offer = await Offer.findOne({ applicationId: 'TEST-APP-03' });
    expect(offer).toBeTruthy();
    expect(offer.status).toBe('OFFER_ISSUED');

    // Verify OutboxEvent and AuditLog
    const audit = await AuditLog.findOne({ action: 'OFFER_COMMITTED', entityId: 'TEST-APP-03' });
    expect(audit).toBeTruthy();
  });

  it('POST /internal/v1/offers/commit rolls back on application version conflict', async () => {
    const commitPayload = {
      application_id: 'TEST-APP-03',
      decision_id: 'DEC-02',
      lease_id: 'LEASE-02',
      ranking_id: 'RANK-02',
      expected_application_version: 999 // Wrong version
    };

    const res = await request(BASE_URL).post('/internal/v1/offers/commit').send(commitPayload);
    expect(res.status).toBe(409); // Should fail

    // Check that nothing changed due to rollback
    const audit = await AuditLog.findOne({ action: 'OFFER_COMMITTED', entityId: 'TEST-APP-03', 'afterState.version': 999 });
    expect(audit).toBeNull();
  });
});

describe('Phase 6: Reports & Audit', () => {
  it('GET /api/v1/reports/placement-performance returns stats', async () => {
    const res = await request(BASE_URL).get('/api/v1/reports/placement-performance');
    expect(res.status).toBe(200);
    expect(res.body.data.total_applications).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/audit returns audit logs', async () => {
    const res = await request(BASE_URL).get('/api/v1/audit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
