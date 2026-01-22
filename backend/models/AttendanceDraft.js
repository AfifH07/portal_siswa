const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AttendanceDraft = sequelize.define('attendance_draft', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  kelas: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  mata_pelajaran: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'attendance_draft',
  timestamps: false
});

module.exports = AttendanceDraft;
