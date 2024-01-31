const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { Sequelize } = require('sequelize');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const onNewUserCallbacks = new Set();

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

sequelize.sync()
  .then(() => {
    console.log('Conexión a la base de datos establecida y sincronizada');
  })
  .catch((error) => {
    console.error('Error al sincronizar con la base de datos:', error);
  });

let onlineUsers = 0;
let registeredUsers = 0;

//WebSocket
wss.on('connection', (socket) => {
  onlineUsers++;
  broadcastOnlineUsers();

  socket.on('close', () => {
    onlineUsers--;
    broadcastOnlineUsers();
  });

  function broadcastOnlineUsers() {
    broadcastToClients({ event: 'onlineUsers', data: onlineUsers });
  }

  const sendBuffer = [];
  const send = (data) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    } else {
      sendBuffer.push(data);
    }
  };

  socket.on('open', () => {
    sendBuffer.forEach((data) => send(data));
    sendBuffer.length = 0;

    console.log('WebSocket reconectado');
  });


  Message.findAll().then((result) => {
    send({ event: 'messages', data: result });
  });

  socket.on('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      await Message.create(parsedMessage);
      broadcastToClients({ event: 'message', data: parsedMessage });
    } catch (error) {
      console.error('Error al procesar y guardar el mensaje:', error);
    }
  });
});

//Short polling - Contador de usuarios en línea
app.get('/api/onlineUsers', (req, res) => {
  try {
    res.json({ onlineUsers });
  } catch (error) {
    console.error('Error al obtener la cantidad de usuarios en línea:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const waitingClients = [];

// Long polling - Contador de usuarios registrados
app.get('/api/registeredUsers', async (req, res) => {
  try {
    const count = await User.count();
    res.json({ registeredUsers: count });
    
    // Resolver las promesas y enviar el nuevo recuento de registeredUsers
    waitingClients.forEach((resolve) => {
      resolve({ registeredUsers: count });
    });

    // Limpiar el conjunto después de resolver las promesas
    waitingClients.length = 0;
  } catch (error) {
    console.error('Error al obtener la cantidad de usuarios registrados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
app.get('/api/waitForRegisteredUsers', async (req, res) => {
  try {
    const waitForRegisteredUsers = new Promise((resolve) => {
      waitingClients.push(resolve);

      req.on('close', () => {
        waitingClients.splice(waitingClients.indexOf(resolve), 1);
      });
    });

    const result = await waitForRegisteredUsers;
    res.json(result);
  } catch (error) {
    console.error('Error al esperar usuarios registrados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/waitForMessages', async (req, res) => {
  try {
    const waitForMessage = new Promise((resolve) => {
      waitingClients.push(resolve);

      req.on('close', () => {
        waitingClients.splice(waitingClients.indexOf(resolve), 1);
      });
    });

    const message = await waitForMessage;
    res.json(message);
  } catch (error) {
    console.error('Error al esperar mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

function broadcastToClients(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (socket) => {
    wss.emit('connection', socket, request);
  });
});

const corsOptions ={
    origin:'*',
    methods: 'GET,POST',
    credentials:true,
    optionSuccessStatus:200
}
app.use(cors(corsOptions));

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

const User = sequelize.define('User', {
  username: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
}, {
  timestamps: false, // Desactiva la generación automática de campos createdAt y updatedAt
});

// Agregar una nueva ruta para el registro de usuarios
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verificar si el usuario ya existe en la base de datos
    const existingUser = await User.findOne({ where: { username } });

    if (existingUser) {
      res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    } else {
      // Crear un nuevo usuario en la base de datos
      const newUser = await User.create({ username, password });

      // Incrementar el contador de usuarios registrados
      registeredUsers++;
      
      // Notificar a los clientes WebSocket sobre el cambio
      broadcastToClients({ event: 'updateRegisteredUsers' });

      res.json({ success: true, user: newUser });
    }
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Buscar el usuario en la base de datos
    const user = await User.findOne({ where: { username, password } });

    if (user) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    console.error('Error al autenticar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
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
