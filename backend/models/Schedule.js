const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Schedule = sequelize.define('schedules', {
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
  hari: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  jam: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  mata_pelajaran: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'schedules',
  timestamps: true
});

module.exports = Schedule;
