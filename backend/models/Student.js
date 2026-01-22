const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('students', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nisn: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  nama: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  kelas: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  program: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'students',
  timestamps: true
});

module.exports = Student;
