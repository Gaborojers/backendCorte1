const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { Sequelize } = require('sequelize');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' },
});

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'localhost',
  username: 'root',
  password: 'LgSc06042004',
  database: 'servidor',
  define: {
    timestamps: true,
  },
});


const users = new Set();
const messages = [];
const onNewUserCallbacks = new Set();

const onNewUser = (callback) => {
  onNewUserCallbacks.add(callback);

  return () => {
    onNewUserCallbacks.delete(callback);
  };
};

// Define el modelo de mensajes
const Message = sequelize.define('Message', {
  username: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  message: {
    type: Sequelize.STRING,
    allowNull: false,
  },
});

// Sincroniza el modelo con la base de datos
sequelize.sync();

// Añadir esta ruta después de la definición de las otras rutas
app.get('/api/messages', async (req, res) => {
  try {
    const allMessages = await Message.findAll();
    res.json(allMessages);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


io.on('connection', (socket) => {
  // Envia mensajes anteriores al nuevo cliente
  Message.findAll().then((result) => {
    socket.emit('messages', result);
  });

  io.emit('userList', Array.from(users));

  socket.on('message', async (message) => {
    const parsedMessage = JSON.parse(message);
    
    // Guardar el mensaje en la base de datos
    await Message.create(parsedMessage);

    // Emitir el mensaje a todos los clientes
    io.emit('message', parsedMessage);
  });
});

app.use(cors({
  origin: 'http://localhost:3000',  // Ajusta esto según la URL de tu aplicación frontend
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
}));

app.get('/api/users', (req, res) => {
  res.json(Array.from(users));
});

app.get('/api/waitForEvents', (req, res) => {
  const handleNewUser = (newUser) => {
    res.json({ event: 'newUser', data: newUser });
  };

  const unsubscribe = onNewUser(handleNewUser);

  const handleDisconnect = () => {
    unsubscribe();
  };

  req.on('close', handleDisconnect);
});

setTimeout(() => {
  const newUser = {
    username: 'NuevoUsuario',
    timestamp: new Date(),
  };

  onNewUserCallbacks.forEach((callback) => {
    callback(newUser);
  });
}, 5000);

server.listen(3001, () => {
  console.log('Servidor escuchando en el puerto 3001');
});
