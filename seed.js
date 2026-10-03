require('dotenv').config();

const mongoose = require('mongoose');

// ==============================
// MODELS
// ==============================

const Student = require('./models/Student');
const Drive = require('./models/Drive');
const Application = require('./models/Application');
const InterviewSlot = require('./models/InterviewSlot');
const AuditLog = require('./models/AuditLog');
const Offer = require('./models/Offer');
const OutboxEvent = require('./models/OutboxEvent');


// ==============================
// DATABASE CONNECTION
// ==============================

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/rit_placement_db';

    await mongoose.connect(mongoURI);

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error(
      'MongoDB connection failed:',
      error.message
    );

    process.exit(1);
  }
};


// ==============================
// 20 STUDENTS
// ==============================

const students = [
  {
    _id: 'STU001',
    name: 'Aarav Patil',
    email: 'aarav.patil@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 9.28,
      attendancePct: 92,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'Python',
      'MongoDB',
      'Node.js',
      'React'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU001-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU002',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    branch: 'IT',
    academic: {
      cgpa: 8.65,
      attendancePct: 88,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'SQL',
      'Python',
      'Web Development'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU002-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU003',
    name: 'Rohan Kulkarni',
    email: 'rohan.kulkarni@example.com',
    branch: 'ECE',
    academic: {
      cgpa: 7.85,
      attendancePct: 81,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'C++',
      'Python',
      'Embedded Systems',
      'SQL'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU003-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU004',
    name: 'Sneha Deshmukh',
    email: 'sneha.deshmukh@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 8.92,
      attendancePct: 95,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Python',
      'Machine Learning',
      'SQL',
      'Flask'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU004-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU005',
    name: 'Aditya Joshi',
    email: 'aditya.joshi@example.com',
    branch: 'IT',
    academic: {
      cgpa: 7.45,
      attendancePct: 78,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'HTML',
      'CSS',
      'JavaScript'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU005-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU006',
    name: 'Ananya More',
    email: 'ananya.more@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 9.05,
      attendancePct: 90,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'Spring Boot',
      'MySQL',
      'Git'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU006-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU007',
    name: 'Vivek Shah',
    email: 'vivek.shah@example.com',
    branch: 'ECE',
    academic: {
      cgpa: 7.25,
      attendancePct: 76,
      backlogs: 1,
      batch: 2027
    },
    skills: [
      'C',
      'C++',
      'Arduino',
      'Embedded Systems'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU007-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU008',
    name: 'Isha Kulkarni',
    email: 'isha.kulkarni@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 8.48,
      attendancePct: 86,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Python',
      'Django',
      'MongoDB',
      'REST API'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU008-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU009',
    name: 'Rahul Pawar',
    email: 'rahul.pawar@example.com',
    branch: 'IT',
    academic: {
      cgpa: 6.95,
      attendancePct: 74,
      backlogs: 1,
      batch: 2027
    },
    skills: [
      'Java',
      'SQL',
      'HTML',
      'CSS'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU009-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU010',
    name: 'Meera Joshi',
    email: 'meera.joshi@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 8.78,
      attendancePct: 89,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Python',
      'Machine Learning',
      'Pandas',
      'NumPy'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU010-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU011',
    name: 'Kunal Desai',
    email: 'kunal.desai@example.com',
    branch: 'ECE',
    academic: {
      cgpa: 8.12,
      attendancePct: 84,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Python',
      'C++',
      'IoT',
      'Arduino'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU011-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU012',
    name: 'Riya Patil',
    email: 'riya.patil@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 9.12,
      attendancePct: 93,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'React',
      'Node.js',
      'MongoDB'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU012-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU013',
    name: 'Omkar Jadhav',
    email: 'omkar.jadhav@example.com',
    branch: 'IT',
    academic: {
      cgpa: 7.72,
      attendancePct: 80,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'Spring Boot',
      'SQL',
      'GitHub'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU013-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU014',
    name: 'Neha Chavan',
    email: 'neha.chavan@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 8.35,
      attendancePct: 87,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Python',
      'SQL',
      'Power BI',
      'Data Analytics'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU014-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU015',
    name: 'Siddharth Rao',
    email: 'siddharth.rao@example.com',
    branch: 'ECE',
    academic: {
      cgpa: 7.58,
      attendancePct: 79,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'C',
      'Python',
      'Embedded C',
      'Microcontrollers'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU015-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU016',
    name: 'Kavya Singh',
    email: 'kavya.singh@example.com',
    branch: 'IT',
    academic: {
      cgpa: 8.88,
      attendancePct: 91,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Java',
      'Python',
      'AWS',
      'Docker'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU016-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU017',
    name: 'Harsh Vaidya',
    email: 'harsh.vaidya@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 7.18,
      attendancePct: 73,
      backlogs: 1,
      batch: 2027
    },
    skills: [
      'C++',
      'Java',
      'DSA',
      'SQL'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU017-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU018',
    name: 'Tanvi Bhosale',
    email: 'tanvi.bhosale@example.com',
    branch: 'CSE',
    academic: {
      cgpa: 9.01,
      attendancePct: 94,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'Python',
      'Deep Learning',
      'TensorFlow',
      'SQL'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU018-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU019',
    name: 'Yash Tiwari',
    email: 'yash.tiwari@example.com',
    branch: 'IT',
    academic: {
      cgpa: 8.02,
      attendancePct: 82,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'JavaScript',
      'React',
      'Node.js',
      'Express'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU019-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  },

  {
    _id: 'STU020',
    name: 'Pooja Mane',
    email: 'pooja.mane@example.com',
    branch: 'ECE',
    academic: {
      cgpa: 7.68,
      attendancePct: 77,
      backlogs: 0,
      batch: 2027
    },
    skills: [
      'C++',
      'Python',
      'IoT',
      'MATLAB'
    ],
    resumes: [
      {
        version: 1,
        url: 'https://example.com/resumes/STU020-v1.pdf',
        uploadedAt: new Date()
      }
    ]
  }
];


// ==============================
// DRIVES
// ==============================

const drives = [
  {
    _id: 'DRV001',
    company: 'TechCorp Solutions',
    package: 1200000,
    seats: 10,

    ruleSet: {
      version: 'v1.0',

      rules: [
        {
          ruleId: 'R1',
          ruleType: 'min_cgpa',
          threshold: 7.5,
          weight: 1.0
        },
        {
          ruleId: 'R2',
          ruleType: 'max_backlogs',
          threshold: 0,
          weight: 1.0
        },
        {
          ruleId: 'R3',
          ruleType: 'min_attendance',
          threshold: 75,
          weight: 1.0
        },
        {
          ruleId: 'R4',
          ruleType: 'allowed_branches',
          threshold: [
            'CSE',
            'IT',
            'ECE'
          ],
          weight: 1.0
        }
      ]
    },

    state: 'ACTIVE',
    version: 1
  },

  {
    _id: 'DRV002',
    company: 'Innovate Systems',
    package: 1000000,
    seats: 8,

    ruleSet: {
      version: 'v1.0',

      rules: [
        {
          ruleId: 'R1',
          ruleType: 'min_cgpa',
          threshold: 8.0,
          weight: 1.0
        },
        {
          ruleId: 'R2',
          ruleType: 'max_backlogs',
          threshold: 0,
          weight: 1.0
        },
        {
          ruleId: 'R3',
          ruleType: 'min_attendance',
          threshold: 75,
          weight: 1.0
        },
        {
          ruleId: 'R4',
          ruleType: 'allowed_branches',
          threshold: [
            'CSE',
            'IT'
          ],
          weight: 1.0
        }
      ]
    },

    state: 'ACTIVE',
    version: 1
  },

  {
    _id: 'DRV003',
    company: 'DataSoft Technologies',
    package: 900000,
    seats: 12,

    ruleSet: {
      version: 'v1.0',

      rules: [
        {
          ruleId: 'R1',
          ruleType: 'min_cgpa',
          threshold: 7.0,
          weight: 1.0
        },
        {
          ruleId: 'R2',
          ruleType: 'max_backlogs',
          threshold: 1,
          weight: 1.0
        },
        {
          ruleId: 'R3',
          ruleType: 'min_attendance',
          threshold: 70,
          weight: 1.0
        },
        {
          ruleId: 'R4',
          ruleType: 'allowed_branches',
          threshold: [
            'CSE',
            'IT',
            'ECE'
          ],
          weight: 1.0
        }
      ]
    },

    state: 'ACTIVE',
    version: 1
  }
];


// ==============================
// APPLICATIONS
// ==============================

const applications = [
  {
    _id: 'APP001',
    studentId: 'STU001',
    driveId: 'DRV001',
    idempotencyKey: 'IDEMP-APP001',

    state: 'APPLIED',

    eligibility: {
      requestId: 'REQ001',
      decisionId: null,
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: null
    },

    rankingId: null,
    rankingStatus: 'PENDING',
    version: 1
  },

  {
    _id: 'APP002',
    studentId: 'STU002',
    driveId: 'DRV001',
    idempotencyKey: 'IDEMP-APP002',

    state: 'APPLIED',

    eligibility: {
      requestId: 'REQ002',
      decisionId: null,
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: null
    },

    rankingId: null,
    rankingStatus: 'PENDING',
    version: 1
  },

  {
    _id: 'APP003',
    studentId: 'STU003',
    driveId: 'DRV002',
    idempotencyKey: 'IDEMP-APP003',

    state: 'APPLIED',

    eligibility: {
      requestId: 'REQ003',
      decisionId: null,
      result: 'NOT_ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [
        'CGPA_REQUIREMENT'
      ],
      leaseId: null
    },

    rankingId: null,
    rankingStatus: 'PENDING',
    version: 1
  },

  {
    _id: 'APP004',
    studentId: 'STU004',
    driveId: 'DRV001',
    idempotencyKey: 'IDEMP-APP004',

    state: 'SHORTLISTED',

    eligibility: {
      requestId: 'REQ004',
      decisionId: 'DEC004',
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: 'LEASE004'
    },

    rankingId: 'RANK004',
    rankingStatus: 'READY',
    version: 2
  },

  {
    _id: 'APP005',
    studentId: 'STU006',
    driveId: 'DRV001',
    idempotencyKey: 'IDEMP-APP005',

    state: 'INTERVIEW_SCHEDULED',

    eligibility: {
      requestId: 'REQ005',
      decisionId: 'DEC005',
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: 'LEASE005'
    },

    rankingId: 'RANK005',
    rankingStatus: 'READY',
    version: 3
  },

  {
    _id: 'APP006',
    studentId: 'STU010',
    driveId: 'DRV003',
    idempotencyKey: 'IDEMP-APP006',

    state: 'APPLIED',

    eligibility: {
      requestId: 'REQ006',
      decisionId: null,
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: null
    },

    rankingId: null,
    rankingStatus: 'PENDING',
    version: 1
  },

  {
    _id: 'APP007',
    studentId: 'STU009',
    driveId: 'DRV002',
    idempotencyKey: 'IDEMP-APP007',

    state: 'NOT_ELIGIBLE',

    eligibility: {
      requestId: 'REQ007',
      decisionId: 'DEC007',
      result: 'NOT_ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [
        'MIN_CGPA',
        'MAX_BACKLOGS',
        'MIN_ATTENDANCE'
      ],
      leaseId: null
    },

    rankingId: null,
    rankingStatus: 'PENDING',
    version: 2
  },

  {
    _id: 'APP008',
    studentId: 'STU012',
    driveId: 'DRV001',
    idempotencyKey: 'IDEMP-APP008',

    state: 'SELECTED',

    eligibility: {
      requestId: 'REQ008',
      decisionId: 'DEC008',
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: 'LEASE008'
    },

    rankingId: 'RANK008',
    rankingStatus: 'READY',
    version: 4
  },

  {
    _id: 'APP009',
    studentId: 'STU016',
    driveId: 'DRV002',
    idempotencyKey: 'IDEMP-APP009',

    state: 'OFFER_ISSUED',

    eligibility: {
      requestId: 'REQ009',
      decisionId: 'DEC009',
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: 'LEASE009'
    },

    rankingId: 'RANK009',
    rankingStatus: 'READY',
    version: 5
  },

  {
    _id: 'APP010',
    studentId: 'STU017',
    driveId: 'DRV003',
    idempotencyKey: 'IDEMP-APP010',

    state: 'WITHDRAWN',

    eligibility: {
      requestId: 'REQ010',
      decisionId: null,
      result: 'ELIGIBLE',
      ruleSetVersion: 'v1.0',
      failedRules: [],
      leaseId: null
    },

    rankingId: null,
    rankingStatus: 'PENDING',
    version: 2
  }
];


// ==============================
// INTERVIEW SLOTS
// ==============================

const interviewSlots = [
  {
    _id: 'SLOT001',
    driveId: 'DRV001',
    date: '2026-10-05',
    startTime: '10:00',
    endTime: '10:30',
    capacity: 5,
    state: 'AVAILABLE',
    version: 1
  },

  {
    _id: 'SLOT002',
    driveId: 'DRV001',
    date: '2026-10-05',
    startTime: '11:00',
    endTime: '11:30',
    capacity: 5,
    state: 'BOOKED',
    version: 1
  },

  {
    _id: 'SLOT003',
    driveId: 'DRV002',
    date: '2026-10-06',
    startTime: '10:00',
    endTime: '10:30',
    capacity: 5,
    state: 'AVAILABLE',
    version: 1
  },

  {
    _id: 'SLOT004',
    driveId: 'DRV003',
    date: '2026-10-07',
    startTime: '10:00',
    endTime: '10:30',
    capacity: 10,
    state: 'AVAILABLE',
    version: 1
  }
];


// ==============================
// AUDIT LOGS
// ==============================

const auditLogs = [
  {
    _id: 'AUD001',
    correlationId: 'CORR001',
    actorId: 'STU001',
    actorRole: 'STUDENT',
    action: 'APPLICATION_CREATED',
    entityName: 'application',
    entityId: 'APP001',
    sourceService: 'TEAM_C',
    beforeState: null,

    afterState: {
      applicationId: 'APP001',
      studentId: 'STU001',
      driveId: 'DRV001',
      state: 'APPLIED'
    },

    timestamp: new Date()
  },

  {
    _id: 'AUD002',
    correlationId: 'CORR002',
    actorId: 'STU002',
    actorRole: 'STUDENT',
    action: 'APPLICATION_CREATED',
    entityName: 'application',
    entityId: 'APP002',
    sourceService: 'TEAM_C',
    beforeState: null,

    afterState: {
      applicationId: 'APP002',
      studentId: 'STU002',
      driveId: 'DRV001',
      state: 'APPLIED'
    },

    timestamp: new Date()
  },

  {
    _id: 'AUD003',
    correlationId: 'CORR004',
    actorId: 'TEAM_A',
    actorRole: 'TEAM_A_ENGINE',
    action: 'ELIGIBILITY_EVALUATED',
    entityName: 'application',
    entityId: 'APP004',
    sourceService: 'TEAM_C',

    beforeState: {
      state: 'APPLIED'
    },

    afterState: {
      state: 'SHORTLISTED',
      eligibility: 'ELIGIBLE'
    },

    timestamp: new Date()
  },

  {
    _id: 'AUD004',
    correlationId: 'CORR008',
    actorId: 'TEAM_B',
    actorRole: 'TEAM_B_ENGINE',
    action: 'RANKING_COMPLETED',
    entityName: 'application',
    entityId: 'APP008',
    sourceService: 'TEAM_C',

    beforeState: {
      state: 'INTERVIEW_SCHEDULED'
    },

    afterState: {
      state: 'SELECTED',
      rankingId: 'RANK008'
    },

    timestamp: new Date()
  }
];


// ==============================
// OFFERS
// ==============================

const offers = [
  {
    _id: 'OFF001',

    applicationId: 'APP009',

    studentId: 'STU016',

    driveId: 'DRV002',

    packageOffered: 1000000,

    offerLetterUrl:
      'https://example.com/offers/OFF001.pdf',

    status: 'OFFER_ISSUED',

    issuedAt: new Date(),

    decisionId: 'DEC009',

    leaseId: 'LEASE009',

    rankingId: 'RANK009'
  }
];


// ==============================
// OUTBOX EVENTS
// ==============================

const outboxEvents = [
  {
    _id: 'EVT001',

    correlationId: 'CORR001',

    eventType: 'APPLICATION_CREATED',

    aggregateType: 'APPLICATION',

    aggregateId: 'APP001',

    payload: {
      application_id: 'APP001',
      student_id: 'STU001',
      drive_id: 'DRV001',
      state: 'APPLIED'
    },

    isPublished: false,

    createdAt: new Date()
  },

  {
    _id: 'EVT002',

    correlationId: 'CORR002',

    eventType: 'APPLICATION_CREATED',

    aggregateType: 'APPLICATION',

    aggregateId: 'APP002',

    payload: {
      application_id: 'APP002',
      student_id: 'STU002',
      drive_id: 'DRV001',
      state: 'APPLIED'
    },

    isPublished: false,

    createdAt: new Date()
  },

  {
    _id: 'EVT003',

    correlationId: 'CORR004',

    eventType: 'APPLICATION_SHORTLISTED',

    aggregateType: 'APPLICATION',

    aggregateId: 'APP004',

    payload: {
      application_id: 'APP004',
      state: 'SHORTLISTED'
    },

    isPublished: false,

    createdAt: new Date()
  },

  {
    _id: 'EVT004',

    correlationId: 'CORR008',

    eventType: 'APPLICATION_SELECTED',

    aggregateType: 'APPLICATION',

    aggregateId: 'APP008',

    payload: {
      application_id: 'APP008',
      state: 'SELECTED',
      ranking_id: 'RANK008'
    },

    isPublished: false,

    createdAt: new Date()
  },

  {
    _id: 'EVT005',

    correlationId: 'CORR009',

    eventType: 'OFFER_ISSUED',

    aggregateType: 'APPLICATION',

    aggregateId: 'APP009',

    payload: {
      application_id: 'APP009',
      offer_id: 'OFF001',
      state: 'OFFER_ISSUED'
    },

    isPublished: false,

    createdAt: new Date()
  }
];


// ==============================
// SEED DATABASE
// ==============================

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('');
    console.log('======================================');
    console.log('CLEARING EXISTING TEAM C DATA');
    console.log('======================================');

    await Student.deleteMany({});
    await Drive.deleteMany({});
    await Application.deleteMany({});
    await InterviewSlot.deleteMany({});
    await AuditLog.deleteMany({});
    await Offer.deleteMany({});
    await OutboxEvent.deleteMany({});


    console.log('');
    console.log('Inserting students...');
    await Student.insertMany(students);

    console.log(
      `✓ ${students.length} students inserted`
    );


    console.log('');
    console.log('Inserting drives...');
    await Drive.insertMany(drives);

    console.log(
      `✓ ${drives.length} drives inserted`
    );


    console.log('');
    console.log('Inserting applications...');
    await Application.insertMany(
      applications
    );

    console.log(
      `✓ ${applications.length} applications inserted`
    );


    console.log('');
    console.log('Inserting interview slots...');
    await InterviewSlot.insertMany(
      interviewSlots
    );

    console.log(
      `✓ ${interviewSlots.length} interview slots inserted`
    );


    console.log('');
    console.log('Inserting audit logs...');
    await AuditLog.insertMany(
      auditLogs
    );

    console.log(
      `✓ ${auditLogs.length} audit logs inserted`
    );


    console.log('');
    console.log('Inserting offers...');
    await Offer.insertMany(offers);

    console.log(
      `✓ ${offers.length} offers inserted`
    );


    console.log('');
    console.log('Inserting outbox events...');
    await OutboxEvent.insertMany(
      outboxEvents
    );

    console.log(
      `✓ ${outboxEvents.length} outbox events inserted`
    );


    console.log('');
    console.log('======================================');
    console.log('TEAM C DATABASE SEEDED SUCCESSFULLY');
    console.log('======================================');

    console.log('');
    console.log('DATABASE SUMMARY');
    console.log('----------------');
    console.log(
      `Students        : ${students.length}`
    );
    console.log(
      `Drives          : ${drives.length}`
    );
    console.log(
      `Applications    : ${applications.length}`
    );
    console.log(
      `Interview Slots : ${interviewSlots.length}`
    );
    console.log(
      `Audit Logs      : ${auditLogs.length}`
    );
    console.log(
      `Offers          : ${offers.length}`
    );
    console.log(
      `Outbox Events   : ${outboxEvents.length}`
    );

    console.log('');
    console.log('======================================');
    console.log('SEED COMPLETED');
    console.log('======================================');

    await mongoose.connection.close();

    process.exit(0);

  } catch (error) {

    console.error('');
    console.error('======================================');
    console.error('SEED FAILED');
    console.error('======================================');

    console.error(error);

    await mongoose.connection.close();

    process.exit(1);
  }
};


// ==============================
// RUN SEED
// ==============================

seedDatabase();