const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { Sequelize } = require('sequelize');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'OPTIONS'] },
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
let waitingClients = [];

const onNewUser = (callback) => {
  onNewUserCallbacks.add(callback);

  return () => {
    onNewUserCallbacks.delete(callback);
  };
};

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

sequelize.sync();

// Endpoint para mensajes con long polling
app.get('/api/waitForMessages', async (req, res) => {
  try {
    const waitForMessage = new Promise((resolve) => {
      waitingClients.push(resolve);

      req.on('close', () => {
        waitingClients = waitingClients.filter((client) => client !== resolve);
      });
    });

    const message = await waitForMessage;
    res.json(message);
  } catch (error) {
    console.error('Error al esperar mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para mensajes con short polling
app.get('/api/getMessages', async (req, res) => {
  try {
    const allMessages = await Message.findAll();
    res.json(allMessages);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

io.on('connection', (socket) => {
  Message.findAll().then((result) => {
    socket.emit('messages', result);
  });

  io.emit('userList', Array.from(users));

  socket.on('message', async (message) => {
    const parsedMessage = JSON.parse(message);

    await Message.create(parsedMessage);

    io.emit('message', parsedMessage);

    // Notificar a clientes en espera (long polling)
    if (waitingClients.length > 0) {
      const waitingClient = waitingClients.shift();
      waitingClient(parsedMessage);
    }
  });
});

const corsOptions ={
    origin:'*',
    methods: 'GET,POST, OPTIONS',
    credentials:true,
    optionSuccessStatus:200
}
app.use(cors(corsOptions));

io.use(cors());

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
