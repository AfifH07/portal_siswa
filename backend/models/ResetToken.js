const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ResetToken = sequelize.define('reset_tokens', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  token: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Active', 'Used'),
    allowNull: false,
    defaultValue: 'Active'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'reset_tokens',
  timestamps: false
});

module.exports = ResetToken;
