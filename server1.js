const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' },
});
const wss = new WebSocket.Server({ noServer: true });

const users = new Set();
const messages = [];
const onNewUserCallbacks = new Set();

const onNewUser = (callback) => {
  onNewUserCallbacks.add(callback);

  return () => {
    onNewUserCallbacks.delete(callback);
  };
};

io.on('connection', (socket) => {
  socket.emit('messages', messages);
  io.emit('userList', Array.from(users));

  socket.on('message', (message) => {
    const parsedMessage = JSON.parse(message);
    messages.push(parsedMessage);
    io.emit('message', parsedMessage);
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'messages', data: messages }));

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'userList', data: Array.from(users) }));
    }
  });

  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);
    messages.push(parsedMessage);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', data: parsedMessage }));
      }
    });
  });
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

app.use(cors({
  origin: '*',
  allowedHeaders: "Access-Control-Allow-Origin",
  methods: ['GET', 'POST'],
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
