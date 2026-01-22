const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('superadmin', 'admin', 'user'),
    allowNull: false,
    defaultValue: 'user'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  nisn: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true
});

module.exports = User;
