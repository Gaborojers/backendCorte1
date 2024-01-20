// db.js

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'mysql', // o 'sqlite'
  storage: 'path/to/database.sqlite', // solo para SQLite
  define: {
    timestamps: true,
  },
});

module.exports = sequelize;
