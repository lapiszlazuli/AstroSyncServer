'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  username: {
    type:      DataTypes.STRING(50),
    allowNull: false,
    unique:    true,
    validate:  {
      len:           [3, 50],
      notEmpty:      true,
      isAlphanumeric: true
    }
  },
  email: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    unique:    true,
    validate:  { isEmail: true, notEmpty: true }
  },
  password: {
    type:      DataTypes.STRING(255),
    allowNull: false   // bcrypt hash
  },
  display_name: {
    type:         DataTypes.STRING(100),
    allowNull:    true,
    defaultValue: null
  },
  location_lat: {
    type:         DataTypes.DECIMAL(9, 6),
    allowNull:    true,
    defaultValue: null,
    comment:      'Ubicación habitual del observador'
  },
  location_lon: {
    type:         DataTypes.DECIMAL(9, 6),
    allowNull:    true,
    defaultValue: null
  },
  location_name: {
    type:         DataTypes.STRING(150),
    allowNull:    true,
    defaultValue: null
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login: {
    type:         DataTypes.DATE,
    allowNull:    true,
    defaultValue: null
  }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['email'] },
    { unique: true, fields: ['username'] }
  ]
});

module.exports = User;
