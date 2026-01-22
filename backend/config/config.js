module.exports = {
  // Konfigurasi Sheets yang diganti dengan Table names
  TABLES: {
    USERS: 'users',
    STUDENTS: 'students',
    ATTENDANCE: 'attendance',
    GRADES: 'grades',
    EVALUATIONS: 'evaluations',
    RESET_TOKENS: 'reset_tokens',
    SCHEDULES: 'schedules',
    ATTENDANCE_DRAFT: 'attendance_draft'
  },

  // Role permissions
  ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    USER: 'user'
  },

  // Token expiration (minutes)
  TOKEN_EXPIRY_MINUTES: parseInt(process.env.TOKEN_EXPIRY_MINUTES) || 30,

  // JWT expiry
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',

  // Auto save interval (seconds)
  AUTO_SAVE_INTERVAL_SECONDS: 30,

  // Upload configuration
  UPLOAD: {
    PATH: process.env.UPLOAD_PATH || './uploads',
    MAX_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    ALLOWED_EXTENSIONS: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif').split(',')
  },

  // Date format
  DATE_FORMAT: 'YYYY-MM-DD',
  DATE_FORMAT_DISPLAY: 'DD/MM/YYYY',

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 100,
    MAX_LIMIT: 1000
  }
};
