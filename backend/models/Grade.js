const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Grade = sequelize.define('grades', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nisn: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  mata_pelajaran: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  nilai: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  semester: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  tahun_ajaran: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  jenis_ujian: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'grades',
  timestamps: true
});

module.exports = Grade;
