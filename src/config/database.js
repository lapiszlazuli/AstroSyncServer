'use strict';
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME    || 'astrosync',
  process.env.DB_USER    || 'root',
  process.env.DB_PASS    || '',
  {
    host:    process.env.DB_HOST    || 'localhost',
    port:    process.env.DB_PORT    || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development'
      ? (sql) => console.log('[SQL]', sql.substring(0, 120) + '...')
      : false,
    define: {
      timestamps: true,
      underscored: true,        // columnas en snake_case
      createdAt:  'created_at',
      updatedAt:  'updated_at'
    },
    pool: {
      max:     10,
      min:     0,
      acquire: 30000,
      idle:    10000
    }
  }
);

module.exports = { sequelize, Sequelize };
