# Team C Backend API Documentation

## 1. PROJECT OVERVIEW
This backend service manages the core entities and transactions for the college placement recruitment process. It handles student profiles, recruitment drives, applications (and their lifecycle states), job offers, reporting, and audit logs. The system is designed to be an event-driven microservice.

**Technology Stack:**
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **ODM:** Mongoose

---

## 2. BASE URL
**Production Environment:**
`https://rit-placement-team-c-backend.onrender.com`

All endpoint paths documented below must be appended to this base URL (e.g., `https://rit-placement-team-c-backend.onrender.com/health`).

---

## 3. ERROR FORMAT
All errors returned by the API follow this standardized JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "message": "Human-readable description of the error"
  },
  "meta": {
    "correlation_id": "uuid-v4-string"
  }
}
```

The `correlation_id` is either provided in the `X-Correlation-ID` request header or generated automatically by the server.

---

## 4. HEALTH / SYSTEM ENDPOINTS

### 4.1. Check Health
- **Method:** `GET`
- **Path:** `/health`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/health`
- **Purpose:** Checks if the Express server is running.
- **Authentication:** None
- **Success Response (200 OK):**
```json
{
  "status": "UP",
  "service": "Team C - Placement Data & Transaction Manager",
  "timestamp": "2026-10-03T09:00:00.000Z",
  "correlation_id": "uuid-string"
}
```

### 4.2. Check Readiness
- **Method:** `GET`
- **Path:** `/ready`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/ready`
- **Purpose:** Checks if the database connection is active and ready to process requests.
- **Authentication:** None
- **Success Response (200 OK):**
```json
{
  "status": "READY",
  "database": "CONNECTED",
  "correlation_id": "uuid-string"
}
```
- **Error Response (503 Service Unavailable):**
```json
{
  "status": "NOT_READY",
  "database": "DISCONNECTED",
  "correlation_id": "uuid-string"
}
```

---

## 5. STUDENT ENDPOINTS

### 5.1. List Students
- **Method:** `GET`
- **Path:** `/api/v1/students`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/students`
- **Purpose:** Retrieves a list of all students.
- **Authentication:** None
- **Success Response (200 OK):**
```json
{
  "data": [
    {
      "_id": "STU-123",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "branch": "CSE",
      "academic": { "cgpa": 9.5, "backlogs": 0, "attendancePct": 100, "batch": 2027 }
    }
  ],
  "meta": { "count": 1, "api_version": "v1", "correlation_id": "uuid" }
}
```

### 5.2. Get Student by ID
- **Method:** `GET`
- **Path:** `/api/v1/students/:studentId`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/students/:studentId`
- **Purpose:** Retrieves a single student by their ID.
- **Authentication:** None
- **Path Parameters:**
  - `studentId` (string): The ID of the student.
- **Error Response (404 Not Found):**
```json
{
  "error": { "code": "STUDENT_NOT_FOUND", "message": "Student not found" },
  "meta": { "correlation_id": "uuid" }
}
```

### 5.3. Create Student
- **Method:** `POST`
- **Path:** `/api/v1/students`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/students`
- **Purpose:** Creates a new student profile.
- **Authentication:** None
- **Request Body (Required fields):**
  - `_id` (string)
  - `name` (string)
  - `email` (string)
  - `branch` (string)
  - `academic` (object) containing `cgpa` (number), `attendancePct` (number), `batch` (number)
- **Optional fields:** `skills` (array of strings), `resumes` (array of objects), `academic.backlogs` (number), `academic.aptitudeScore` (number).
- **Success Response (201 Created):**
```json
{
  "data": { "_id": "STU-123", "name": "Jane Doe", "email": "jane@example.com" },
  "meta": { "api_version": "v1", "correlation_id": "uuid" }
}
```
- **Error Responses:** 
  - `400 Bad Request` (`INVALID_STUDENT_DATA`)
  - `409 Conflict` (`STUDENT_ALREADY_EXISTS`)

---

## 6. DRIVE ENDPOINTS

### 6.1. List Drives
- **Method:** `GET`
- **Path:** `/api/v1/drives`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/drives`
- **Purpose:** Retrieves a list of all placement drives.
- **Authentication:** None

### 6.2. Get Drive by ID
- **Method:** `GET`
- **Path:** `/api/v1/drives/:driveId`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/drives/:driveId`
- **Purpose:** Retrieves a single placement drive.
- **Authentication:** None
- **Path Parameters:** `driveId` (string)

### 6.3. Get Drive Criteria
- **Method:** `GET`
- **Path:** `/api/v1/drives/:driveId/criteria`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/drives/:driveId/criteria`
- **Purpose:** Retrieves the eligibility criteria (rule set) for a drive.
- **Authentication:** None
- **Path Parameters:** `driveId` (string)

### 6.4. Update Drive
- **Method:** `PATCH`
- **Path:** `/api/v1/drives/:driveId`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/drives/:driveId`
- **Purpose:** Updates a drive's fields (company, package, ruleSet, state). Also publishes an audit log and outbox event.
- **Authentication:** None (Uses headers `x-actor-id` and `x-actor-role` for audit logs if provided)
- **Path Parameters:** `driveId` (string)
- **Request Body (Optional fields):** `company`, `package`, `ruleSet`, `state`
- **Success Response (200 OK):** Returns the updated drive object.

---

## 7. APPLICATION ENDPOINTS

### 7.1. Create Application
- **Method:** `POST`
- **Path:** `/api/v1/applications`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/applications`
- **Purpose:** Submits an application for a student to a drive. Implements an idempotent, transactional creation process.
- **Authentication:** None (Uses headers `x-actor-id` and `x-actor-role` for audit logs if provided)
- **Request Body (Required fields):**
  - `application_id` (string)
  - `student_id` (string)
  - `drive_id` (string)
  - `resume_version` (number)
  - `consent` (boolean, must be true)
  - `idempotency_key` (string)
- **Success Response (201 Created or 200 OK if replayed):**
```json
{
  "data": {
    "application_id": "APP-123",
    "student_id": "STU-123",
    "drive_id": "DRV-123",
    "state": "APPLIED",
    "version": 1
  },
  "meta": { "api_version": "v1", "correlation_id": "uuid", "idempotent_replay": false }
}
```
- **Error Responses:**
  - `400 Bad Request` (`INVALID_APPLICATION_DATA`)
  - `404 Not Found` (`STUDENT_NOT_FOUND`, `DRIVE_NOT_FOUND`)
  - `409 Conflict` (`DRIVE_NOT_ACTIVE`, `DUPLICATE_APPLICATION`)

### 7.2. List Applications
- **Method:** `GET`
- **Path:** `/api/v1/applications`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/applications`
- **Purpose:** Lists all applications.
- **Authentication:** None

### 7.3. Get Application by ID
- **Method:** `GET`
- **Path:** `/api/v1/applications/:applicationId`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/applications/:applicationId`
- **Purpose:** Gets a specific application along with references to its audit logs.
- **Authentication:** None
- **Path Parameters:** `applicationId` (string)

### 7.4. Withdraw Application
- **Method:** `POST`
- **Path:** `/api/v1/applications/:applicationId/withdraw`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/applications/:applicationId/withdraw`
- **Purpose:** Withdraws an active application.
- **Authentication:** None (Uses headers `x-actor-id` and `x-actor-role` for audit logs if provided)
- **Path Parameters:** `applicationId` (string)
- **Error Responses:**
  - `404 Not Found` (`APPLICATION_NOT_FOUND`)
  - `409 Conflict` (`WITHDRAWAL_NOT_ALLOWED`) - Triggers if application is already SELECTED, OFFER_ISSUED, or WITHDRAWN.

### 7.5. Update Application Eligibility
- **Method:** `POST`
- **Path:** `/internal/v1/applications/:applicationId/eligibility`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/internal/v1/applications/:applicationId/eligibility`
- **Purpose:** Internal endpoint used by Team A to store eligibility evaluation results for an application.
- **Authentication:** Bearer token via `Authorization: Bearer <token>` header. Requires `TEAM_C_CALLBACK_TOKEN` to be configured on the server.
- **Headers:**
  - `Authorization`: `Bearer <TEAM_C_CALLBACK_TOKEN>` (required)
  - `Content-Type`: `application/json` (required)
  - `X-Correlation-ID`: Optional correlation UUID for tracing
- **Path Parameters:** `applicationId` (string)
- **Request Body (Required fields):**
  - `request_id` (string)
  - `decision_id` (string)
  - `result` (string, one of `ELIGIBLE`, `CONDITIONAL`, `NOT_ELIGIBLE`)
  - `rule_set_version` (string)
  - `failed_rules` (array of strings)
  - `lease_id` (string or null). Important rules:
    - If `result` is `ELIGIBLE`, `lease_id` must be a valid, non-empty string.
    - If `result` is `CONDITIONAL` or `NOT_ELIGIBLE`, `lease_id` can be `null` if no lease exists.
    - Omitted values, empty strings, and malformed types are rejected.
- **Success Response (200 OK):**
```json
{
  "data": {
    "application_id": "APP-123",
    "eligibility": {
      "requestId": "REQ-123",
      "decisionId": "DEC-123",
      "result": "ELIGIBLE",
      "ruleSetVersion": "v1.0",
      "failedRules": [],
      "leaseId": "LEASE-123"
    },
    "version": 2
  },
  "meta": { "api_version": "v1", "correlation_id": "uuid" }
}
```
- **Error Responses:**
  - `400 Bad Request` (`INVALID_ELIGIBILITY_DATA`, `INVALID_ELIGIBILITY_RESULT`)
  - `401 Unauthorized` (`UNAUTHORIZED`) - Missing, malformed, or invalid bearer token.
  - `404 Not Found` (`APPLICATION_NOT_FOUND`)
  - `500 Internal Server Error` (`CONFIGURATION_ERROR`) - Server-side `TEAM_C_CALLBACK_TOKEN` is missing or unconfigured (fails closed).

---

## 8. OFFER ENDPOINTS

### 8.1. Commit Offer
- **Method:** `POST`
- **Path:** `/internal/v1/offers/commit`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/internal/v1/offers/commit`
- **Purpose:** Internal endpoint to formally issue an offer. Modifies the application state, decreases drive seat count, creates an Offer entity, and logs the transaction.
- **Authentication:** None (Internal endpoint)
- **Request Body (Required fields):**
  - `application_id` (string)
  - `decision_id` (string)
  - `lease_id` (string)
  - `ranking_id` (string)
  - `expected_application_version` (number)
- **Success Response (200 OK):**
```json
{
  "data": { "commit_status": "COMMITTED", "offer_id": "OFF-123" },
  "meta": { "api_version": "v1", "correlation_id": "uuid" }
}
```
- **Error Responses:**
  - `404 Not Found` (`APPLICATION_NOT_FOUND`, `DRIVE_NOT_FOUND`)
  - `409 Conflict` (`APPLICATION_VERSION_CONFLICT`, `NO_SEATS_AVAILABLE`)

### 8.2. Compensate Offer
- **Method:** `POST`
- **Path:** `/internal/v1/offers/compensate`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/internal/v1/offers/compensate`
- **Purpose:** Sets an application to a `COMPENSATION_REQUIRED` state if there are downstream transactional failures.
- **Authentication:** None (Internal endpoint)
- **Request Body (Required fields):**
  - `application_id` (string)
  - `reason` (string)
- **Success Response (200 OK):**
```json
{
  "data": {
    "application_id": "APP-123",
    "compensation_status": "RECORDED",
    "state": "COMPENSATION_REQUIRED"
  },
  "meta": { "api_version": "v1", "correlation_id": "uuid" }
}
```

---

## 9. DRIVE RANKING ENDPOINTS (TEAM B INTEGRATION)

### 9.1. Store Drive Ranking Run
- **Method:** `POST`
- **Path:** `/internal/v1/drive-rankings`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/internal/v1/drive-rankings`
- **Purpose:** Stores an immutable ranking run snapshot generated by Team B's Ranking Engine for a drive. Atomically updates each candidate application's `rankingId` and sets `rankingStatus` to `READY`, while maintaining previous ranking runs for audit and historical analysis. Participates in multi-document transactions with AuditLog and OutboxEvent creation.
- **Authentication:** Bearer token via `Authorization: Bearer <token>` header. Requires `TEAM_B_CALLBACK_TOKEN` configured in environment variables.
- **Headers:**
  - `Authorization`: `Bearer <TEAM_B_CALLBACK_TOKEN>` (required)
  - `Content-Type`: `application/json` (required)
  - `X-Correlation-ID`: Optional correlation UUID for tracing
- **Request Body (Required fields):**
  - `driveId` (string, non-empty): Unique ID of the placement drive.
  - `rankingId` (string, non-empty): Unique ID for this ranking execution.
  - `algorithm` (string, non-empty): Ranking algorithm name (e.g., `MERGE_SORT`).
  - `graphVersion` (string, non-empty): Algorithm/graph version identifier.
  - `tieBreakRule` (string, non-empty): Explanation of the tie-break policy applied.
  - `rankedCandidates` (array of objects, non-empty): List of ranked candidates, where each object contains:
    - `studentId` (string, non-empty): ID of the student.
    - `applicationId` (string, non-empty): ID of the student's application.
    - `rank` (number, positive integer >= 1): Unique ordinal rank.
    - `totalScore` (number, finite): Composite numerical score.
- **Validation & Business Rules:**
  - `driveId` must exist in the database.
  - All `applicationId` entries must exist, belong to `driveId`, and belong to the specified `studentId`.
  - Applications in non-rankable lifecycle states (`WITHDRAWN`, `REJECTED`, `NOT_ELIGIBLE`, `EXPIRED`, `COMPENSATION_REQUIRED`, or `OFFER_ISSUED`) are rejected with `409 Conflict`.
  - If any application in the drive already has an issued or accepted offer (`Offer.status in ['OFFER_ISSUED', 'ACCEPTED']`), re-ranking recalculations are rejected with `409 Conflict`.
  - Application lifecycle states (`state`) and eligibility fields are preserved and not overwritten.
  - Idempotent replay: Re-sending the exact same `rankingId` and logical payload returns `200 OK` with `meta.idempotent_replay: true`. Submitting the same `rankingId` with a different payload returns `409 Conflict`.
- **Success Response (201 Created or 200 OK for Replay):**
```json
{
  "data": {
    "_id": "67...abc",
    "driveId": "DRV001",
    "rankingId": "RANK-DRV001-001",
    "algorithm": "MERGE_SORT",
    "graphVersion": "TEAM-CURRENT",
    "tieBreakRule": "Higher score first, student ID as tie-break",
    "rankedCandidates": [
      {
        "studentId": "STU001",
        "applicationId": "APP001",
        "rank": 1,
        "totalScore": 14.28
      },
      {
        "studentId": "STU012",
        "applicationId": "APP012",
        "rank": 2,
        "totalScore": 13.12
      }
    ],
    "isLatest": true,
    "createdAt": "2026-10-13T10:00:00.000Z",
    "updatedAt": "2026-10-13T10:00:00.000Z"
  },
  "meta": {
    "api_version": "v1",
    "correlation_id": "uuid",
    "idempotent_replay": false
  }
}
```
- **Error Responses:**
  - `400 Bad Request` (`INVALID_RANKING_DATA`, `INVALID_CANDIDATE_DATA`, `DUPLICATE_RANK_FOUND`, `DUPLICATE_STUDENT_FOUND`, `DUPLICATE_APPLICATION_FOUND`, `APPLICATION_DRIVE_MISMATCH`, `APPLICATION_STUDENT_MISMATCH`)
  - `401 Unauthorized` (`UNAUTHORIZED`) - Missing, malformed, or invalid bearer token.
  - `404 Not Found` (`DRIVE_NOT_FOUND`, `APPLICATION_NOT_FOUND`)
  - `409 Conflict` (`RANKING_ID_CONFLICT`, `APPLICATION_NOT_RANKABLE`, `OFFER_ALREADY_ISSUED`)
  - `500 Internal Server Error` (`CONFIGURATION_ERROR`) - Server-side `TEAM_B_CALLBACK_TOKEN` missing.

---

### 9.2. Get Drive Ranking History
- **Method:** `GET`
- **Path:** `/internal/v1/drives/:driveId/rankings`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/internal/v1/drives/:driveId/rankings`
- **Purpose:** Retrieves all historical ranking runs for a drive in reverse chronological order (`createdAt: -1`). The latest accepted run is marked with `"isLatest": true`.
- **Authentication:** Bearer token via `Authorization: Bearer <TEAM_B_CALLBACK_TOKEN>` header.
- **Path Parameters:**
  - `driveId` (string): The drive ID.
- **Success Response (200 OK):**
```json
{
  "data": [
    {
      "_id": "67...def",
      "driveId": "DRV001",
      "rankingId": "RANK-DRV001-002",
      "algorithm": "MERGE_SORT",
      "graphVersion": "TEAM-CURRENT",
      "tieBreakRule": "Higher score first, student ID as tie-break",
      "rankedCandidates": [ ... ],
      "isLatest": true,
      "createdAt": "2026-10-13T12:00:00.000Z"
    },
    {
      "_id": "67...abc",
      "driveId": "DRV001",
      "rankingId": "RANK-DRV001-001",
      "algorithm": "MERGE_SORT",
      "graphVersion": "TEAM-CURRENT",
      "tieBreakRule": "Higher score first, student ID as tie-break",
      "rankedCandidates": [ ... ],
      "isLatest": false,
      "createdAt": "2026-10-13T10:00:00.000Z"
    }
  ],
  "meta": {
    "count": 2,
    "api_version": "v1",
    "correlation_id": "uuid"
  }
}
```
- **Error Responses:**
  - `401 Unauthorized` (`UNAUTHORIZED`)
  - `404 Not Found` (`DRIVE_NOT_FOUND`)
  - `500 Internal Server Error` (`CONFIGURATION_ERROR`)

---

## 10. REPORT / AUDIT ENDPOINTS


### 9.1. Placement Performance Report
- **Method:** `GET`
- **Path:** `/api/v1/reports/placement-performance`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/reports/placement-performance`
- **Purpose:** Returns aggregate statistics based on application states.
- **Authentication:** None
- **Success Response (200 OK):**
```json
{
  "data": {
    "total_applications": 100,
    "applied": 20,
    "shortlisted": 10,
    "selected": 5,
    "offers": 5,
    "withdrawn": 10,
    "rejected": 50
  },
  "meta": { "api_version": "v1", "correlation_id": "uuid" }
}
```

### 9.2. Query Audit Logs
- **Method:** `GET`
- **Path:** `/api/v1/audit`
- **Full URL:** `https://rit-placement-team-c-backend.onrender.com/api/v1/audit`
- **Purpose:** Fetches the system audit logs. Can be filtered via query parameters. Returns the latest 500 logs.
- **Authentication:** None
- **Query Parameters (Optional):**
  - `applicationId` (string)
  - `entityName` (string)
  - `entityId` (string)
  - `correlationId` (string)
- **Success Response (200 OK):** Returns an array of `AuditLog` objects in the `data` array.

---

## 11. API USAGE EXAMPLES

### curl (Create Application)
```bash
curl -X POST https://rit-placement-team-c-backend.onrender.com/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: 12345678" \
  -d '{
    "application_id": "APP-001",
    "student_id": "STU-001",
    "drive_id": "DRV-001",
    "resume_version": 1,
    "consent": true,
    "idempotency_key": "IDEMP-001"
  }'
```

### curl (Update Application Eligibility - ELIGIBLE)
```bash
curl -X POST https://rit-placement-team-c-backend.onrender.com/internal/v1/applications/APP-001/eligibility \
  -H "Authorization: Bearer <TEAM_C_CALLBACK_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: 12345678" \
  -d '{
    "request_id": "REQ-123",
    "decision_id": "DEC-123",
    "result": "ELIGIBLE",
    "rule_set_version": "v1.0",
    "failed_rules": [],
    "lease_id": "LEASE-123"
  }'
```

### curl (Update Application Eligibility - CONDITIONAL)
```bash
curl -X POST https://rit-placement-team-c-backend.onrender.com/internal/v1/applications/APP-001/eligibility \
  -H "Authorization: Bearer <TEAM_C_CALLBACK_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: 12345678" \
  -d '{
    "request_id": "REQ-124",
    "decision_id": "DEC-124",
    "result": "CONDITIONAL",
    "rule_set_version": "v1.0",
    "failed_rules": ["GPA_REQUIREMENT"],
    "lease_id": null
  }'
```

### curl (Store Drive Ranking Run - Team B)
```bash
curl -X POST https://rit-placement-team-c-backend.onrender.com/internal/v1/drive-rankings \
  -H "Authorization: Bearer <TEAM_B_CALLBACK_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: 12345678" \
  -d '{
    "driveId": "DRV001",
    "rankingId": "RANK-DRV001-001",
    "algorithm": "MERGE_SORT",
    "graphVersion": "TEAM-CURRENT",
    "tieBreakRule": "Higher score first, student ID as tie-break",
    "rankedCandidates": [
      {
        "studentId": "STU001",
        "applicationId": "APP001",
        "rank": 1,
        "totalScore": 14.28
      },
      {
        "studentId": "STU012",
        "applicationId": "APP012",
        "rank": 2,
        "totalScore": 13.12
      }
    ]
  }'
```

### curl (Get Drive Ranking History - Team B)
```bash
curl -X GET https://rit-placement-team-c-backend.onrender.com/internal/v1/drives/DRV001/rankings \
  -H "Authorization: Bearer <TEAM_B_CALLBACK_TOKEN>" \
  -H "X-Correlation-ID: 12345678"
```

### fetch (Get Placement Performance)
```javascript
fetch('https://rit-placement-team-c-backend.onrender.com/api/v1/reports/placement-performance', {
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

---

## 12. INTEGRATION NOTES
- **API First:** Other teams must communicate with Team C exclusively through this REST API.
- **No Direct DB Access:** Other microservices or clients should **NOT** connect directly to the MongoDB instance. Do not request the MongoDB connection string.
- **Internal Namespaces:** Inter-service endpoints (`/internal/v1/...`) are dedicated for microservice communication (e.g. Team A eligibility evaluations, Team A offer commits, Team B ranking submissions). General client endpoints reside under `/api/v1/...`.
- **Correlation IDs:** Clients are heavily encouraged to pass the `X-Correlation-ID` header with their requests for easier distributed tracing.
- **Audit Actor context:** When modifying drives or creating/withdrawing applications, clients can pass `x-actor-id` and `x-actor-role` headers to attribute the changes accurately in the audit logs.

---

## 13. RENDER NOTE
The backend is currently hosted on Render's free tier. Render may spin down the instance after a period of inactivity (15 minutes). **The very first request made after inactivity may take up to 50 seconds or longer to respond while the server wakes up.** Subsequent requests will be processed instantly.

---

## 14. ENDPOINT INVENTORY

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| GET | `/health` | Check application health | None |
| GET | `/ready` | Check database readiness | None |
| GET | `/api/v1/students` | List all students | None |
| GET | `/api/v1/students/:studentId` | Get student by ID | None |
| POST | `/api/v1/students` | Create new student | None |
| GET | `/api/v1/drives` | List all drives | None |
| GET | `/api/v1/drives/:driveId` | Get drive by ID | None |
| GET | `/api/v1/drives/:driveId/criteria` | Get drive criteria | None |
| PATCH | `/api/v1/drives/:driveId` | Update drive details | None |
| GET | `/api/v1/applications` | List all applications | None |
| GET | `/api/v1/applications/:applicationId` | Get application by ID | None |
| POST | `/api/v1/applications` | Create application | None |
| POST | `/api/v1/applications/:applicationId/withdraw` | Withdraw application | None |
| POST | `/internal/v1/applications/:applicationId/eligibility` | Update application eligibility | Bearer Token (`TEAM_C_CALLBACK_TOKEN`) |
| POST | `/internal/v1/drive-rankings` | Store drive ranking run | Bearer Token (`TEAM_B_CALLBACK_TOKEN`) |
| GET | `/internal/v1/drives/:driveId/rankings` | Get drive ranking history | Bearer Token (`TEAM_B_CALLBACK_TOKEN`) |
| POST | `/internal/v1/offers/commit` | Commit a job offer | None |
| POST | `/internal/v1/offers/compensate` | Compensate an offer | None |
| GET | `/api/v1/reports/placement-performance` | Get placement statistics | None |
| GET | `/api/v1/audit` | Query audit logs | None |

