// models/message.js

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Message = sequelize.define('Message', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = Message;
