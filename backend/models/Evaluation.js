const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Evaluation = sequelize.define('evaluations', {
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
  jenis: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  evaluator: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  nama_evaluator: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  nama_siswa: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  foto_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tindak_lanjut: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'evaluations',
  timestamps: true
});

module.exports = Evaluation;
