const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nisn: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  waktu: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  keterangan: {
    type: DataTypes.TEXT,
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
  tableName: 'attendance',
  timestamps: false
});

module.exports = Attendance;
