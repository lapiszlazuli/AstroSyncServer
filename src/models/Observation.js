'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

// ObservationSession — agrupa varias observaciones de una misma noche/salida
const ObservationSession = sequelize.define('ObservationSession', {
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
  // Código de 6 letras para sincronizar con Android (ej: "ASTRO7")
  sync_code: {
    type:      DataTypes.STRING(10),
    allowNull: true,
    unique:    true,
    comment:   'Código para unirse a la sesión desde Android/Watch'
  },
  location_lat: {
    type:      DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  location_lon: {
    type:      DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  location_name: {
    type:      DataTypes.STRING(150),
    allowNull: true
  },
  // Condiciones de observación
  seeing:       { type: DataTypes.TINYINT, allowNull: true, comment: '1-5 (Antoniadi scale)' },
  transparency: { type: DataTypes.TINYINT, allowNull: true, comment: '1-5' },
  temperature:  { type: DataTypes.FLOAT,   allowNull: true, comment: 'Celsius' },
  humidity:     { type: DataTypes.FLOAT,   allowNull: true, comment: 'Porcentaje' },
  notes:        { type: DataTypes.TEXT,    allowNull: true },
  started_at:   { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
  ended_at:     { type: DataTypes.DATE,    allowNull: true },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'observation_sessions',
  indexes: [{ fields: ['sync_code'] }, { fields: ['user_id'] }]
});

// Observation — un objeto observado individual
const Observation = sequelize.define('Observation', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  session_id: {
    type:       DataTypes.INTEGER,
    allowNull:  true,
    references: { model: ObservationSession, key: 'id' }
  },
  user_id: {
    type:       DataTypes.INTEGER,
    allowNull:  false,
    references: { model: User, key: 'id' }
  },
  object_name:   { type: DataTypes.STRING(100), allowNull: false },
  object_type:   {
    type:         DataTypes.ENUM('star', 'planet', 'moon', 'sun', 'messier', 'galaxy', 'nebula', 'cluster', 'other'),
    defaultValue: 'other'
  },
  // Coordenadas ecuatoriales J2000
  ra:            { type: DataTypes.DECIMAL(10, 6), allowNull: true, comment: 'Ascensión Recta en horas' },
  dec_coord:     { type: DataTypes.DECIMAL(10, 6), allowNull: true, comment: 'Declinación en grados' },
  // Coordenadas horizontales al momento de observar
  alt_observed:  { type: DataTypes.DECIMAL(8, 4),  allowNull: true, comment: 'Altitud en grados' },
  az_observed:   { type: DataTypes.DECIMAL(8, 4),  allowNull: true, comment: 'Azimut en grados' },
  // Metadata
  magnitude:     { type: DataTypes.DECIMAL(5, 2),  allowNull: true },
  constellation: { type: DataTypes.STRING(100),    allowNull: true },
  notes:         { type: DataTypes.TEXT,            allowNull: true },
  observed_at:   { type: DataTypes.DATE,            defaultValue: DataTypes.NOW },
  // Cómo se registró
  aligned_by:    {
    type:         DataTypes.ENUM('web', 'android', 'smartwatch', 'manual'),
    defaultValue: 'web'
  },
  // Precisión de la alineación Android (grados de error)
  alignment_accuracy: { type: DataTypes.FLOAT, allowNull: true },
  // Equipment usado
  equipment:     { type: DataTypes.STRING(200), allowNull: true }
}, {
  tableName: 'observations',
  indexes: [{ fields: ['user_id'] }, { fields: ['session_id'] }, { fields: ['observed_at'] }]
});

// AlignmentEvent — log de cuando el Android apuntó correctamente
const AlignmentEvent = sequelize.define('AlignmentEvent', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  user_id:       { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  session_id:    { type: DataTypes.INTEGER, allowNull: true },
  object_name:   { type: DataTypes.STRING(100), allowNull: false },
  accuracy_deg:  { type: DataTypes.FLOAT, comment: 'Grados de error al alinear' },
  device_type:   { type: DataTypes.ENUM('android', 'web'), defaultValue: 'android' },
  phone_azimuth: { type: DataTypes.FLOAT, allowNull: true },
  phone_altitude:{ type: DataTypes.FLOAT, allowNull: true },
  target_azimuth:{ type: DataTypes.FLOAT, allowNull: true },
  target_altitude:{ type: DataTypes.FLOAT, allowNull: true },
  occurred_at:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'alignment_events',
  indexes: [{ fields: ['user_id'] }, { fields: ['occurred_at'] }]
});

// ─── Asociaciones ─────────────────────────────────────────────────────────────
User.hasMany(ObservationSession, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ObservationSession.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Observation, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Observation.belongsTo(User, { foreignKey: 'user_id' });
ObservationSession.hasMany(Observation, { foreignKey: 'session_id', onDelete: 'SET NULL' });
Observation.belongsTo(ObservationSession, { foreignKey: 'session_id' });

User.hasMany(AlignmentEvent, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AlignmentEvent.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { ObservationSession, Observation, AlignmentEvent };
