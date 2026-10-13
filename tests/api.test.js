require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');

jest.setTimeout(30000);

const app = require('../app');
const BASE_URL = app;

const Application = require('../models/Application');
const Drive = require('../models/Drive');
const Student = require('../models/Student');
const Offer = require('../models/Offer');
const AuditLog = require('../models/AuditLog');
const OutboxEvent = require('../models/OutboxEvent');
const DriveRanking = require('../models/DriveRanking');

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
  const testApps = await Application.find({ _id: { $in: ['TEST-APP-01', 'TEST-APP-02', 'TEST-APP-03', 'TEST-APP-04'] } });
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

describe('Phase 7: Eligibility updates', () => {
  const TEST_CALLBACK_TOKEN = 'test-callback-token';
  let originalCallbackToken;

  beforeAll(() => {
    originalCallbackToken = process.env.TEAM_C_CALLBACK_TOKEN;
    process.env.TEAM_C_CALLBACK_TOKEN = TEST_CALLBACK_TOKEN;
  });

  afterAll(() => {
    if (originalCallbackToken !== undefined) {
      process.env.TEAM_C_CALLBACK_TOKEN = originalCallbackToken;
    } else {
      delete process.env.TEAM_C_CALLBACK_TOKEN;
    }
  });

  it('POST /internal/v1/applications/:id/eligibility updates eligibility successfully and preserves unrelated fields', async () => {
    // Ensure robust cleanup before running the test
    await Application.deleteOne({ _id: 'TEST-APP-04' });
    
    // 1. Create a new application
    const appPayload = {
      application_id: 'TEST-APP-04',
      student_id: 'TEST-STU-04',
      drive_id: 'TEST-DRV-01',
      resume_version: 1,
      consent: true,
      idempotency_key: 'IDEMP-TEST-APP-04'
    };
    await request(BASE_URL).post('/api/v1/applications').send(appPayload);

    const appBefore = await Application.findById('TEST-APP-04');
    const versionBefore = appBefore.version;
    const stateBefore = appBefore.state;
    const studentIdBefore = appBefore.studentId;

    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .set('X-Correlation-ID', 'CORR-ELIG-123')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.meta.correlation_id).toBe('CORR-ELIG-123');
    expect(res.body.data.eligibility.result).toBe('ELIGIBLE');

    const appAfter = await Application.findById('TEST-APP-04');
    expect(appAfter.version).toBe(versionBefore + 1);
    expect(appAfter.state).toBe(stateBefore); // state preserved
    expect(appAfter.studentId).toBe(studentIdBefore); // other fields preserved
    
    // Verify complete eligibility object
    expect(appAfter.eligibility.requestId).toBe('REQ-123');
    expect(appAfter.eligibility.decisionId).toBe('DEC-123');
    expect(appAfter.eligibility.result).toBe('ELIGIBLE');
    expect(appAfter.eligibility.ruleSetVersion).toBe('v1.0');
    expect(appAfter.eligibility.failedRules).toEqual([]);
    expect(appAfter.eligibility.leaseId).toBe('LEASE-123');
    
    // Verify AuditLog
    const audit = await AuditLog.findOne({ entityId: 'TEST-APP-04', action: 'ELIGIBILITY_UPDATED' });
    expect(audit).toBeTruthy();
    expect(audit.correlationId).toBe('CORR-ELIG-123');
    expect(audit.action).toBe('ELIGIBILITY_UPDATED');
    expect(audit.entityId).toBe('TEST-APP-04');
    expect(audit.sourceService).toBe('TEAM_C');
    
    // Verify OutboxEvent
    const event = await OutboxEvent.findOne({ aggregateId: 'TEST-APP-04', eventType: 'APPLICATION_ELIGIBILITY_UPDATED' });
    expect(event).toBeTruthy();
    expect(event.correlationId).toBe('CORR-ELIG-123');
    expect(event.eventType).toBe('APPLICATION_ELIGIBILITY_UPDATED');
    expect(event.aggregateType).toBe('APPLICATION');
    expect(event.aggregateId).toBe('TEST-APP-04');
    expect(event.payload.eligibility.result).toBe('ELIGIBLE');
    expect(event.payload.version).toBe(versionBefore + 1);
  });

  it('POST /internal/v1/applications/:id/eligibility returns 404 for unknown application', async () => {
    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-999/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    
    expect(res.status).toBe(404);
  });

  it('POST /internal/v1/applications/:id/eligibility returns 400 for missing required field', async () => {
    const payload = {
      decision_id: 'DEC-123', // missing request_id
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    
    expect(res.status).toBe(400);
  });

  it('POST /internal/v1/applications/:id/eligibility returns 400 for invalid result', async () => {
    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'INVALID_RESULT',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    
    expect(res.status).toBe(400);
  });

  it('POST /internal/v1/applications/:id/eligibility returns 400 for invalid failed_rules type', async () => {
    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: 'not-an-array', // invalid
      lease_id: 'LEASE-123'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    
    expect(res.status).toBe(400);

    const payload2 = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [123], // invalid array elements
      lease_id: 'LEASE-123'
    };
    const res2 = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload2);
    
    expect(res2.status).toBe(400);
  });

  it('POST /internal/v1/applications/:id/eligibility returns 400 for ELIGIBLE with lease_id: null', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'ELIGIBLE',
      rule_set_version: 'v1.0', failed_rules: [], lease_id: null
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('POST /internal/v1/applications/:id/eligibility succeeds for CONDITIONAL with lease_id: null', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'CONDITIONAL',
      rule_set_version: 'v1.0', failed_rules: ['RULE_1'], lease_id: null
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(200);
    const appAfter = await Application.findById('TEST-APP-04');
    expect(appAfter.eligibility.leaseId).toBeNull();
  });

  it('POST /internal/v1/applications/:id/eligibility succeeds for NOT_ELIGIBLE with lease_id: null', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'NOT_ELIGIBLE',
      rule_set_version: 'v1.0', failed_rules: ['RULE_1'], lease_id: null
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(200);
    const appAfter = await Application.findById('TEST-APP-04');
    expect(appAfter.eligibility.leaseId).toBeNull();
  });

  it('POST /internal/v1/applications/:id/eligibility succeeds for CONDITIONAL with valid lease_id', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'CONDITIONAL',
      rule_set_version: 'v1.0', failed_rules: ['RULE_1'], lease_id: 'LEASE-456'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(200);
    const appAfter = await Application.findById('TEST-APP-04');
    expect(appAfter.eligibility.leaseId).toBe('LEASE-456');
  });

  it('POST /internal/v1/applications/:id/eligibility succeeds for NOT_ELIGIBLE with valid lease_id', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'NOT_ELIGIBLE',
      rule_set_version: 'v1.0', failed_rules: ['RULE_1'], lease_id: 'LEASE-456'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(200);
    const appAfter = await Application.findById('TEST-APP-04');
    expect(appAfter.eligibility.leaseId).toBe('LEASE-456');
  });

  it('POST /internal/v1/applications/:id/eligibility rejects empty-string lease_id', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'ELIGIBLE',
      rule_set_version: 'v1.0', failed_rules: [], lease_id: ''
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('POST /internal/v1/applications/:id/eligibility rejects numeric, object, and array values for lease_id', async () => {
    const payloads = [
      { lease_id: 123 },
      { lease_id: {} },
      { lease_id: [] }
    ];
    for (const p of payloads) {
      const payload = {
        request_id: 'REQ-123', decision_id: 'DEC-123', result: 'ELIGIBLE',
        rule_set_version: 'v1.0', failed_rules: [], ...p
      };
      const res = await request(BASE_URL)
        .post('/internal/v1/applications/TEST-APP-04/eligibility')
        .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
        .send(payload);
      expect(res.status).toBe(400);
    }
  });

  it('POST /internal/v1/applications/:id/eligibility rejects omitted lease_id', async () => {
    const payload = {
      request_id: 'REQ-123', decision_id: 'DEC-123', result: 'ELIGIBLE',
      rule_set_version: 'v1.0', failed_rules: []
      // lease_id omitted
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
      .send(payload);
    expect(res.status).toBe(400);
  });

  // Authentication test cases
  it('POST /internal/v1/applications/:id/eligibility returns 401 when Authorization header is missing', async () => {
    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /internal/v1/applications/:id/eligibility returns 401 for incorrect token', async () => {
    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };
    const res = await request(BASE_URL)
      .post('/internal/v1/applications/TEST-APP-04/eligibility')
      .set('Authorization', 'Bearer wrong-callback-token')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /internal/v1/applications/:id/eligibility returns 401 for malformed authorization header', async () => {
    const payload = {
      request_id: 'REQ-123',
      decision_id: 'DEC-123',
      result: 'ELIGIBLE',
      rule_set_version: 'v1.0',
      failed_rules: [],
      lease_id: 'LEASE-123'
    };
    const badHeaders = [
      'Basic test-callback-token',
      'Bearer',
      'Bearer token extra',
      'test-callback-token'
    ];
    for (const h of badHeaders) {
      const res = await request(BASE_URL)
        .post('/internal/v1/applications/TEST-APP-04/eligibility')
        .set('Authorization', h)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('POST /internal/v1/applications/:id/eligibility fails closed with 500 when server token is missing and does not modify data', async () => {
    const appBefore = await Application.findById('TEST-APP-04');
    const versionBefore = appBefore ? appBefore.version : 1;
    const eligibilityBefore = appBefore ? JSON.stringify(appBefore.eligibility) : null;

    delete process.env.TEAM_C_CALLBACK_TOKEN;

    try {
      const payload = {
        request_id: 'REQ-UNAUTH',
        decision_id: 'DEC-UNAUTH',
        result: 'ELIGIBLE',
        rule_set_version: 'v1.0',
        failed_rules: [],
        lease_id: 'LEASE-UNAUTH'
      };
      const res = await request(BASE_URL)
        .post('/internal/v1/applications/TEST-APP-04/eligibility')
        .set('Authorization', `Bearer ${TEST_CALLBACK_TOKEN}`)
        .send(payload);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('CONFIGURATION_ERROR');

      // Verify application data was NOT modified
      const appAfter = await Application.findById('TEST-APP-04');
      if (appBefore) {
        expect(appAfter.version).toBe(versionBefore);
        expect(JSON.stringify(appAfter.eligibility)).toBe(eligibilityBefore);
      }
    } finally {
      process.env.TEAM_C_CALLBACK_TOKEN = TEST_CALLBACK_TOKEN;
    }
  });
});

describe('Phase 8: Team B Rankings Integration', () => {
  const TEST_B_TOKEN = 'test-team-b-callback-token';
  let origToken;

  beforeAll(async () => {
    origToken = process.env.TEAM_B_CALLBACK_TOKEN;
    process.env.TEAM_B_CALLBACK_TOKEN = TEST_B_TOKEN;

    await DriveRanking.syncIndexes();

    // Create test drive for rankings
    await Drive.create({
      _id: 'TEST-DRV-RANK',
      company: 'Ranking Dynamics',
      package: 1500000,
      seats: 3,
      state: 'ACTIVE',
      version: 1,
      ruleSet: { version: 'v1.0', rules: [] }
    });

    // Create test drive with an issued offer
    await Drive.create({
      _id: 'TEST-DRV-OFFER',
      company: 'Offer Dynamics',
      package: 1800000,
      seats: 2,
      state: 'ACTIVE',
      version: 1,
      ruleSet: { version: 'v1.0', rules: [] }
    });

    // Create test drive for concurrency
    await Drive.create({
      _id: 'TEST-DRV-CONC',
      company: 'Concurrency Corp',
      package: 1400000,
      seats: 2,
      state: 'ACTIVE',
      version: 1,
      ruleSet: { version: 'v1.0', rules: [] }
    });

    // Create test students
    await Student.create([
      {
        _id: 'TEST-STU-R1',
        name: 'Rank Candidate 1',
        email: 'r1@example.com',
        branch: 'CSE',
        academic: { cgpa: 9.3, backlogs: 0, attendancePct: 95, batch: 2027 }
      },
      {
        _id: 'TEST-STU-R2',
        name: 'Rank Candidate 2',
        email: 'r2@example.com',
        branch: 'IT',
        academic: { cgpa: 8.9, backlogs: 0, attendancePct: 90, batch: 2027 }
      },
      {
        _id: 'TEST-STU-R3',
        name: 'Rank Candidate 3',
        email: 'r3@example.com',
        branch: 'ECE',
        academic: { cgpa: 8.4, backlogs: 0, attendancePct: 85, batch: 2027 }
      },
      {
        _id: 'TEST-STU-R4',
        name: 'Rank Candidate 4',
        email: 'r4@example.com',
        branch: 'MECH',
        academic: { cgpa: 7.5, backlogs: 0, attendancePct: 80, batch: 2027 }
      },
      {
        _id: 'TEST-STU-R5',
        name: 'Offer Candidate 5',
        email: 'r5@example.com',
        branch: 'CSE',
        academic: { cgpa: 9.8, backlogs: 0, attendancePct: 98, batch: 2027 }
      },
      {
        _id: 'TEST-STU-C1',
        name: 'Conc Candidate 1',
        email: 'c1@example.com',
        branch: 'CSE',
        academic: { cgpa: 9.0, backlogs: 0, attendancePct: 90, batch: 2027 }
      },
      {
        _id: 'TEST-STU-C2',
        name: 'Conc Candidate 2',
        email: 'c2@example.com',
        branch: 'IT',
        academic: { cgpa: 8.5, backlogs: 0, attendancePct: 85, batch: 2027 }
      }
    ]);

    // Create test applications
    await Application.create([
      {
        _id: 'TEST-APP-R1',
        studentId: 'TEST-STU-R1',
        driveId: 'TEST-DRV-RANK',
        idempotencyKey: 'IDEMP-APP-R1',
        state: 'INTERVIEW_SCHEDULED',
        version: 1
      },
      {
        _id: 'TEST-APP-R2',
        studentId: 'TEST-STU-R2',
        driveId: 'TEST-DRV-RANK',
        idempotencyKey: 'IDEMP-APP-R2',
        state: 'INTERVIEW_SCHEDULED',
        version: 1
      },
      {
        _id: 'TEST-APP-R3',
        studentId: 'TEST-STU-R3',
        driveId: 'TEST-DRV-RANK',
        idempotencyKey: 'IDEMP-APP-R3',
        state: 'INTERVIEW_SCHEDULED',
        version: 1
      },
      {
        _id: 'TEST-APP-R4',
        studentId: 'TEST-STU-R4',
        driveId: 'TEST-DRV-RANK',
        idempotencyKey: 'IDEMP-APP-R4',
        state: 'WITHDRAWN', // non-rankable
        version: 1
      },
      {
        _id: 'TEST-APP-R5',
        studentId: 'TEST-STU-R5',
        driveId: 'TEST-DRV-OFFER',
        idempotencyKey: 'IDEMP-APP-R5',
        state: 'OFFER_ISSUED',
        version: 2
      },
      {
        _id: 'TEST-APP-C1',
        studentId: 'TEST-STU-C1',
        driveId: 'TEST-DRV-CONC',
        idempotencyKey: 'IDEMP-APP-C1',
        state: 'INTERVIEW_SCHEDULED',
        version: 1
      },
      {
        _id: 'TEST-APP-C2',
        studentId: 'TEST-STU-C2',
        driveId: 'TEST-DRV-CONC',
        idempotencyKey: 'IDEMP-APP-C2',
        state: 'INTERVIEW_SCHEDULED',
        version: 1
      }
    ]);

    // Create test offer
    await Offer.create({
      _id: 'TEST-OFF-01',
      applicationId: 'TEST-APP-R5',
      studentId: 'TEST-STU-R5',
      driveId: 'TEST-DRV-OFFER',
      packageOffered: 1800000,
      status: 'OFFER_ISSUED',
      rankingId: 'RANK-EXISTING-OFFER'
    });
  });

  afterAll(async () => {
    if (origToken !== undefined) {
      process.env.TEAM_B_CALLBACK_TOKEN = origToken;
    } else {
      delete process.env.TEAM_B_CALLBACK_TOKEN;
    }

    await Drive.deleteMany({ _id: { $in: ['TEST-DRV-RANK', 'TEST-DRV-OFFER', 'TEST-DRV-CONC'] } });
    await Student.deleteMany({ _id: { $in: ['TEST-STU-R1', 'TEST-STU-R2', 'TEST-STU-R3', 'TEST-STU-R4', 'TEST-STU-R5', 'TEST-STU-C1', 'TEST-STU-C2'] } });
    await Application.deleteMany({ _id: { $in: ['TEST-APP-R1', 'TEST-APP-R2', 'TEST-APP-R3', 'TEST-APP-R4', 'TEST-APP-R5', 'TEST-APP-C1', 'TEST-APP-C2'] } });
    await Offer.deleteMany({ _id: 'TEST-OFF-01' });
    await DriveRanking.deleteMany({ driveId: { $in: ['TEST-DRV-RANK', 'TEST-DRV-OFFER', 'TEST-DRV-CONC'] } });
    await AuditLog.deleteMany({ entityId: { $in: ['TEST-DRV-RANK', 'TEST-DRV-OFFER', 'TEST-DRV-CONC'] } });
    await OutboxEvent.deleteMany({ aggregateId: { $in: ['TEST-DRV-RANK', 'TEST-DRV-OFFER', 'TEST-DRV-CONC'] } });
  });


  const validRankingPayload = {
    driveId: 'TEST-DRV-RANK',
    rankingId: 'RANK-TEST-001',
    algorithm: 'MERGE_SORT',
    graphVersion: 'TEAM-CURRENT',
    tieBreakRule: 'Higher score first, student ID as tie-break',
    rankedCandidates: [
      {
        studentId: 'TEST-STU-R1',
        applicationId: 'TEST-APP-R1',
        rank: 1,
        totalScore: 18.5
      },
      {
        studentId: 'TEST-STU-R2',
        applicationId: 'TEST-APP-R2',
        rank: 2,
        totalScore: 16.2
      }
    ]
  };

  it('1. Successfully creates ranking snapshot, updates applications, and writes audit/outbox', async () => {
    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .set('X-Correlation-ID', 'CORR-RANK-001')
      .send(validRankingPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.rankingId).toBe('RANK-TEST-001');
    expect(res.body.data.isLatest).toBe(true);
    expect(res.body.meta.correlation_id).toBe('CORR-RANK-001');
    expect(res.body.meta.idempotent_replay).toBe(false);

    // Verify DriveRanking in DB
    const savedRanking = await DriveRanking.findOne({ rankingId: 'RANK-TEST-001' });
    expect(savedRanking).toBeTruthy();
    expect(savedRanking.isLatest).toBe(true);
    expect(savedRanking.rankedCandidates.length).toBe(2);

    // Verify Application updates (rankingId and rankingStatus set, version incremented, state untouched)
    const app1 = await Application.findById('TEST-APP-R1');
    expect(app1.rankingId).toBe('RANK-TEST-001');
    expect(app1.rankingStatus).toBe('READY');
    expect(app1.version).toBe(2);
    expect(app1.state).toBe('INTERVIEW_SCHEDULED'); // Unchanged

    const app2 = await Application.findById('TEST-APP-R2');
    expect(app2.rankingId).toBe('RANK-TEST-001');
    expect(app2.rankingStatus).toBe('READY');
    expect(app2.version).toBe(2);
    expect(app2.state).toBe('INTERVIEW_SCHEDULED'); // Unchanged

    // Verify AuditLog
    const audit = await AuditLog.findOne({ entityId: 'TEST-DRV-RANK', action: 'RANKING_COMPLETED' });
    expect(audit).toBeTruthy();
    expect(audit.actorId).toBe('TEAM_B');
    expect(audit.actorRole).toBe('TEAM_B_ENGINE');
    expect(audit.sourceService).toBe('TEAM_B');
    expect(audit.correlationId).toBe('CORR-RANK-001');

    // Verify OutboxEvent
    const outbox = await OutboxEvent.findOne({ aggregateId: 'TEST-DRV-RANK', eventType: 'DRIVE_RANKING_COMPLETED' });
    expect(outbox).toBeTruthy();
    expect(outbox.payload.ranking_id).toBe('RANK-TEST-001');
    expect(outbox.correlationId).toBe('CORR-RANK-001');
  });

  it('2. Successfully retrieves ranking history for a drive in reverse chronological order', async () => {
    const res = await request(BASE_URL)
      .get('/internal/v1/drives/TEST-DRV-RANK/rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].rankingId).toBe('RANK-TEST-001');
    expect(res.body.data[0].isLatest).toBe(true);
  });

  it('3. Rejects missing, malformed, or invalid authorization token (401)', async () => {
    // Missing header
    const res1 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .send(validRankingPayload);
    expect(res1.status).toBe(401);
    expect(res1.body.error.code).toBe('UNAUTHORIZED');

    // Invalid token
    const res2 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', 'Bearer wrong-token')
      .send(validRankingPayload);
    expect(res2.status).toBe(401);
    expect(res2.body.error.code).toBe('UNAUTHORIZED');

    // Malformed header
    const res3 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', 'Basic 12345')
      .send(validRankingPayload);
    expect(res3.status).toBe(401);
    expect(res3.body.error.code).toBe('UNAUTHORIZED');
  });

  it('4. Fails closed with 500 CONFIGURATION_ERROR if TEAM_B_CALLBACK_TOKEN is missing', async () => {
    delete process.env.TEAM_B_CALLBACK_TOKEN;

    try {
      const res = await request(BASE_URL)
        .post('/internal/v1/drive-rankings')
        .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
        .send(validRankingPayload);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('CONFIGURATION_ERROR');
    } finally {
      process.env.TEAM_B_CALLBACK_TOKEN = TEST_B_TOKEN;
    }
  });

  it('5. Rejects request with non-existent drive (404)', async () => {
    const payload = {
      ...validRankingPayload,
      driveId: 'NON-EXISTENT-DRIVE',
      rankingId: 'RANK-TEST-MISSING-DRV'
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DRIVE_NOT_FOUND');
  });

  it('6. Rejects request with non-existent application (404)', async () => {
    const payload = {
      ...validRankingPayload,
      rankingId: 'RANK-TEST-MISSING-APP',
      rankedCandidates: [
        {
          studentId: 'TEST-STU-R1',
          applicationId: 'NON-EXISTENT-APP',
          rank: 1,
          totalScore: 19.0
        }
      ]
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPLICATION_NOT_FOUND');
  });

  it('7. Rejects application belonging to a different drive (400)', async () => {
    const payload = {
      ...validRankingPayload,
      rankingId: 'RANK-TEST-DRV-MISMATCH',
      rankedCandidates: [
        {
          studentId: 'TEST-STU-01',
          applicationId: 'TEST-APP-01', // belongs to TEST-DRV-01, not TEST-DRV-RANK
          rank: 1,
          totalScore: 15.0
        }
      ]
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('APPLICATION_DRIVE_MISMATCH');
  });

  it('8. Rejects application belonging to a different student (400)', async () => {
    const payload = {
      ...validRankingPayload,
      rankingId: 'RANK-TEST-STU-MISMATCH',
      rankedCandidates: [
        {
          studentId: 'TEST-STU-R2', // Mismatched student for TEST-APP-R1
          applicationId: 'TEST-APP-R1',
          rank: 1,
          totalScore: 15.0
        }
      ]
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('APPLICATION_STUDENT_MISMATCH');
  });

  it('9. Validates candidate arrays, ranks, IDs, and scores (400)', async () => {
    // Empty candidate array
    const res1 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send({ ...validRankingPayload, rankedCandidates: [] });
    expect(res1.status).toBe(400);

    // Rank is non-integer or < 1
    const res2 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send({
        ...validRankingPayload,
        rankedCandidates: [
          { studentId: 'TEST-STU-R1', applicationId: 'TEST-APP-R1', rank: 0, totalScore: 10 }
        ]
      });
    expect(res2.status).toBe(400);

    // Score is not a number
    const res3 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send({
        ...validRankingPayload,
        rankedCandidates: [
          { studentId: 'TEST-STU-R1', applicationId: 'TEST-APP-R1', rank: 1, totalScore: 'ten' }
        ]
      });
    expect(res3.status).toBe(400);
  });

  it('10. Rejects duplicate ranks, students, and applications within the same payload (400)', async () => {
    // Duplicate ranks
    const res1 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send({
        ...validRankingPayload,
        rankedCandidates: [
          { studentId: 'TEST-STU-R1', applicationId: 'TEST-APP-R1', rank: 1, totalScore: 10 },
          { studentId: 'TEST-STU-R2', applicationId: 'TEST-APP-R2', rank: 1, totalScore: 9 }
        ]
      });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe('DUPLICATE_RANK_FOUND');

    // Duplicate students
    const res2 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send({
        ...validRankingPayload,
        rankedCandidates: [
          { studentId: 'TEST-STU-R1', applicationId: 'TEST-APP-R1', rank: 1, totalScore: 10 },
          { studentId: 'TEST-STU-R1', applicationId: 'TEST-APP-R2', rank: 2, totalScore: 9 }
        ]
      });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('DUPLICATE_STUDENT_FOUND');

    // Duplicate applications
    const res3 = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send({
        ...validRankingPayload,
        rankedCandidates: [
          { studentId: 'TEST-STU-R1', applicationId: 'TEST-APP-R1', rank: 1, totalScore: 10 },
          { studentId: 'TEST-STU-R2', applicationId: 'TEST-APP-R1', rank: 2, totalScore: 9 }
        ]
      });
    expect(res3.status).toBe(400);
    expect(res3.body.error.code).toBe('DUPLICATE_APPLICATION_FOUND');
  });

  it('11. Handles identical replay with same rankingId idempotently (200, idempotent_replay: true)', async () => {
    const auditsBefore = await AuditLog.countDocuments({ entityId: 'TEST-DRV-RANK' });
    const outboxBefore = await OutboxEvent.countDocuments({ aggregateId: 'TEST-DRV-RANK' });

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(validRankingPayload);

    expect(res.status).toBe(200);
    expect(res.body.meta.idempotent_replay).toBe(true);
    expect(res.body.data.rankingId).toBe('RANK-TEST-001');

    // Verify no new audit or outbox events created on replay
    const auditsAfter = await AuditLog.countDocuments({ entityId: 'TEST-DRV-RANK' });
    const outboxAfter = await OutboxEvent.countDocuments({ aggregateId: 'TEST-DRV-RANK' });
    expect(auditsAfter).toBe(auditsBefore);
    expect(outboxAfter).toBe(outboxBefore);
  });

  it('12. Rejects same rankingId submitted with different payload (409 RANKING_ID_CONFLICT)', async () => {
    const conflictingPayload = {
      ...validRankingPayload,
      algorithm: 'QUICK_SORT' // Modified algorithm
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(conflictingPayload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RANKING_ID_CONFLICT');
  });

  it('13. Supports recalculation: creates new snapshot, preserves previous one, and updates latest-marker atomically', async () => {
    const recalculatePayload = {
      driveId: 'TEST-DRV-RANK',
      rankingId: 'RANK-TEST-002',
      algorithm: 'MERGE_SORT_V2',
      graphVersion: 'TEAM-V2',
      tieBreakRule: 'Updated tiebreak',
      rankedCandidates: [
        {
          studentId: 'TEST-STU-R2',
          applicationId: 'TEST-APP-R2',
          rank: 1,
          totalScore: 19.5
        },
        {
          studentId: 'TEST-STU-R1',
          applicationId: 'TEST-APP-R1',
          rank: 2,
          totalScore: 17.0
        },
        {
          studentId: 'TEST-STU-R3',
          applicationId: 'TEST-APP-R3',
          rank: 3,
          totalScore: 14.0
        }
      ]
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(recalculatePayload);

    expect(res.status).toBe(201);
    expect(res.body.data.rankingId).toBe('RANK-TEST-002');
    expect(res.body.data.isLatest).toBe(true);

    // Verify previous snapshot is preserved and no longer latest
    const prevSnapshot = await DriveRanking.findOne({ rankingId: 'RANK-TEST-001' });
    expect(prevSnapshot).toBeTruthy();
    expect(prevSnapshot.isLatest).toBe(false);

    // Verify new snapshot is latest
    const newSnapshot = await DriveRanking.findOne({ rankingId: 'RANK-TEST-002' });
    expect(newSnapshot).toBeTruthy();
    expect(newSnapshot.isLatest).toBe(true);

    // Verify applications have updated rankingId and READY status
    const app3 = await Application.findById('TEST-APP-R3');
    expect(app3.rankingId).toBe('RANK-TEST-002');
    expect(app3.rankingStatus).toBe('READY');
  });

  it('14. Ensures exactly one latest run per drive', async () => {
    const latestRuns = await DriveRanking.find({ driveId: 'TEST-DRV-RANK', isLatest: true });
    expect(latestRuns.length).toBe(1);
    expect(latestRuns[0].rankingId).toBe('RANK-TEST-002');
  });

  it('15. Rejects ranking recalculation when an offer is already issued in the drive (409 OFFER_ALREADY_ISSUED)', async () => {
    const offerDrivePayload = {
      driveId: 'TEST-DRV-OFFER',
      rankingId: 'RANK-CONFLICT-OFFER',
      algorithm: 'MERGE_SORT',
      graphVersion: 'V1',
      tieBreakRule: 'Standard',
      rankedCandidates: [
        {
          studentId: 'TEST-STU-R5',
          applicationId: 'TEST-APP-R5',
          rank: 1,
          totalScore: 20.0
        }
      ]
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(offerDrivePayload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OFFER_ALREADY_ISSUED');
  });

  it('16. Rejects non-rankable application (WITHDRAWN) and rolls back cleanly (409)', async () => {
    const nonRankablePayload = {
      driveId: 'TEST-DRV-RANK',
      rankingId: 'RANK-TEST-FAIL-NONRANK',
      algorithm: 'MERGE_SORT',
      graphVersion: 'V1',
      tieBreakRule: 'Standard',
      rankedCandidates: [
        {
          studentId: 'TEST-STU-R4',
          applicationId: 'TEST-APP-R4', // WITHDRAWN
          rank: 1,
          totalScore: 10.0
        }
      ]
    };

    const res = await request(BASE_URL)
      .post('/internal/v1/drive-rankings')
      .set('Authorization', `Bearer ${TEST_B_TOKEN}`)
      .send(nonRankablePayload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPLICATION_NOT_RANKABLE');

    // Verify rollback: no DriveRanking created with this ID
    const failedSnapshot = await DriveRanking.findOne({ rankingId: 'RANK-TEST-FAIL-NONRANK' });
    expect(failedSnapshot).toBeNull();
  });

  it('17. Verifies audit and outbox creation exactly once per accepted run', async () => {
    const auditCount = await AuditLog.countDocuments({
      entityId: 'TEST-DRV-RANK',
      action: 'RANKING_COMPLETED',
      'afterState.rankingId': 'RANK-TEST-002'
    });
    expect(auditCount).toBe(1);

    const outboxCount = await OutboxEvent.countDocuments({
      aggregateId: 'TEST-DRV-RANK',
      eventType: 'DRIVE_RANKING_COMPLETED',
      'payload.ranking_id': 'RANK-TEST-002'
    });
    expect(outboxCount).toBe(1);
  });

  it('18. Enforces atomic uniqueness and rollback under concurrent submissions via Promise.all', async () => {
    const payloadA = {
      driveId: 'TEST-DRV-CONC',
      rankingId: 'RANK-CONC-001',
      algorithm: 'MERGE_SORT',
      graphVersion: 'V1',
      tieBreakRule: 'Rule A',
      rankedCandidates: [
        { studentId: 'TEST-STU-C1', applicationId: 'TEST-APP-C1', rank: 1, totalScore: 19.0 },
        { studentId: 'TEST-STU-C2', applicationId: 'TEST-APP-C2', rank: 2, totalScore: 18.0 }
      ]
    };

    const payloadB = {
      driveId: 'TEST-DRV-CONC',
      rankingId: 'RANK-CONC-002',
      algorithm: 'QUICK_SORT',
      graphVersion: 'V1',
      tieBreakRule: 'Rule B',
      rankedCandidates: [
        { studentId: 'TEST-STU-C2', applicationId: 'TEST-APP-C2', rank: 1, totalScore: 19.5 },
        { studentId: 'TEST-STU-C1', applicationId: 'TEST-APP-C1', rank: 2, totalScore: 17.5 }
      ]
    };

    // Execute concurrently using Promise.all
    const [resA, resB] = await Promise.all([
      request(BASE_URL).post('/internal/v1/drive-rankings').set('Authorization', `Bearer ${TEST_B_TOKEN}`).send(payloadA),
      request(BASE_URL).post('/internal/v1/drive-rankings').set('Authorization', `Bearer ${TEST_B_TOKEN}`).send(payloadB)
    ]);

    const statuses = [resA.status, resB.status];
    // Both responses must be well-formed: either 201 (success) or 409 (conflict)
    expect(statuses.every(s => s === 201 || s === 409)).toBe(true);
    // At least one must succeed
    expect(statuses.includes(201)).toBe(true);

    // CRITICAL DATABASE INTEGRITY ASSERTION:
    // Under no circumstances can two documents have isLatest: true for the same drive
    const latestSnapshots = await DriveRanking.find({ driveId: 'TEST-DRV-CONC', isLatest: true });
    expect(latestSnapshots.length).toBe(1);

    // If one failed with 409, verify its rankingId was completely rolled back
    if (statuses.includes(409)) {
      const failedPayload = resA.status === 409 ? payloadA : payloadB;
      const failedDoc = await DriveRanking.findOne({ rankingId: failedPayload.rankingId });
      expect(failedDoc).toBeNull();
    }
  }, 60000);
});




