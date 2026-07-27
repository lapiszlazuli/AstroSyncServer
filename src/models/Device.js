'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Device = sequelize.define('Device', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  user_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: 'id' }
  },
  device_type: {
    type:         DataTypes.ENUM('android', 'wearos', 'web', 'ios'),
    allowNull:    false,
    defaultValue: 'android'
  },
  device_name: {
    type:      DataTypes.STRING(150),
    allowNull: true
  },
  device_model: {
    type:      DataTypes.STRING(100),
    allowNull: true,
    comment:   'Ej: Samsung Galaxy S24'
  },
  fcm_token: {
    type:      DataTypes.TEXT,
    allowNull: true,
    comment:   'Firebase Cloud Messaging token para notificaciones push'
  },
  last_seen: {
    type:         DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'devices'
});

// Asociaciones
User.hasMany(Device, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Device.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Device;
