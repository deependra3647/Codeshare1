require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const ACTIONS = require('./src/Actions');
const { runUserCode } = require('./runCode');
const { GoogleGenerativeAI } = require('@google/generative-ai');

app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB — needed for file share (base64 dataUrl)
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeshare';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'codeshare';
let downloadsCollection;

const userSocketMap = {};
const roomAdminMap = {};
const roomCodeMap = {};
const roomLanguageMap = {}; // { roomId: languageId }
const roomWritePermissions = {};
const roomPendingRequests = {}; // { roomId: [{ socketId, username }] }
const roomFilesMap = {};  // { roomId: [fileObjects] }

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
    const isAdmin = roomAdminMap[roomId] === socketId;
    const canWrite = isAdmin || (roomWritePermissions[roomId] && roomWritePermissions[roomId][socketId] === true);
    return { socketId, username: userSocketMap[socketId], isAdmin, canWrite: canWrite !== false };
  });
}

function admitUser(roomId, socketId, username) {
  const sock = io.sockets.sockets.get(socketId);
  if (!sock) return;

  sock.join(roomId);
  if (!roomWritePermissions[roomId]) roomWritePermissions[roomId] = {};
  roomWritePermissions[roomId][socketId] = false; // non-admin starts with no write

  const clients = getAllConnectedClients(roomId);
  const currentCode = roomCodeMap[roomId] || null;
  const currentLanguage = roomLanguageMap[roomId] || null;

  clients.forEach(({ socketId: sid }) => {
    const isClientAdmin = roomAdminMap[roomId] === sid;
    const clientCanWrite = isClientAdmin || (roomWritePermissions[roomId][sid] === true);
    io.to(sid).emit(ACTIONS.JOINED, {
      clients,
      username,
      socketId,
      isAdmin: isClientAdmin,
      canWrite: clientCanWrite,
      code: sid === socketId ? currentCode : null,
      language: currentLanguage,
    });
  });

  if (currentCode) {
    setTimeout(() => sock.emit(ACTIONS.CODE_CHANGE, { code: currentCode }), 100);
  }

  // Send existing shared files to newly admitted user
  const existingFiles = roomFilesMap[roomId] || [];
  existingFiles.forEach(file => {
    sock.emit(ACTIONS.FILE_SHARE, { file });
  });
}

app.post('/api/run', async (req, res) => {
  const { language, code, stdin } = req.body || {};
  try {
    const result = await runUserCode(language, code, stdin);
    res.json(result);
  } catch (err) {
    console.error('Failed to execute code', err);
    res.status(502).json({
      stdout: '',
      stderr: err.message || 'Failed to execute code.',
      isError: true,
      exitCode: 1,
    });
  }
});


// ── AI Code Explainer ─────────────────────────────────────────────────────
app.post('/api/ai/explain', async (req, res) => {
  const { code, language } = req.body || {};

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ message: 'No code provided to explain.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(503).json({ message: 'AI service is not configured. Please set GEMINI_API_KEY on the server.' });
  }

  const langLabel = language && language !== 'plaintext' ? language : 'code';

  const prompt = `You are a helpful coding assistant that explains code to beginners in a clear and friendly way.

Explain the following ${langLabel} code. Your explanation must include these sections in order:
1. **Purpose** – What does this code do overall?
2. **Step-by-step logic** – Walk through the code block by block or line by line.
3. **Key variables, functions, and conditions** – Explain their roles.
4. **Example or dry run** – Where appropriate, show a simple example of how the code executes.
5. **Output or return value** – What does the code produce or return, if determinable?
6. **Time Complexity** – State the Big O notation and briefly explain why, based strictly on the submitted code. If the code has no algorithmic complexity (e.g. it is a single print statement or plain text), write "Not applicable" and explain why.
7. **Space Complexity** – State the Big O notation and briefly explain why, based strictly on the submitted code. If not applicable, state so and explain why.

Keep the explanation beginner-friendly. Do not invent behaviour that is not present in the code. Do not claim the code was executed. Do not guess complexity — derive it only from what is present in the code.

IMPORTANT FORMATTING RULES — follow these exactly:
- Write all Big O complexity values as plain text only, for example: O(1), O(N), O(N^2), O(log N), O(N log N).
- Do NOT wrap any complexity value in LaTeX dollar-sign delimiters. Never write $O(1)$ or $$O(N)$$. Always write O(1) or O(N) as plain text.
- You may use **bold** Markdown for emphasis, but never use $ or $$ for any purpose.

\`\`\`${langLabel}
${code}
\`\`\``;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      { model: 'gemini-3.8-flash' },
      { timeout: 30000 }
    );

    const result = await model.generateContent(prompt);
    const explanation = result.response.text();
    return res.json({ explanation });
  } catch (err) {
    console.error('Gemini API error — status:', err.status, '| message:', err.message, '| full:', err);

    if (err.status === 429 || (err.message && err.message.includes('429'))) {
      return res.status(429).json({ message: 'AI rate limit reached. Please wait a moment and try again.' });
    }
    if (err.status === 401 || (err.message && (err.message.includes('API key') || err.message.includes('401')))) {
      return res.status(401).json({ message: 'Invalid Gemini API key. Check your GEMINI_API_KEY in .env.' });
    }
    if (err.status === 400 || (err.message && err.message.includes('400'))) {
      return res.status(400).json({ message: `Bad request to Gemini: ${err.message}` });
    }
    return res.status(502).json({ message: `AI service error: ${err.message || 'Unknown error. Check server logs.'}` });
  }
});

app.post('/api/downloads', async (req, res) => {
  if (!downloadsCollection) return res.status(503).json({ message: 'Database not ready' });
  const { roomId, username, code } = req.body || {};
  if (!roomId) return res.status(400).json({ message: 'roomId is required' });
  try {
    const result = await downloadsCollection.insertOne({
      roomId, username: username || 'unknown', code: code || '', downloadedAt: new Date(),
    });
    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    console.error('Failed to save download record', err);
    res.status(500).json({ message: 'Failed to save download' });
  }
});

// Serve static build only if folder exists (production with frontend bundled)
const buildPath = path.join(__dirname, 'build');
if (require('fs').existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.use((_req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;

    // First user in room becomes admin and joins immediately
    if (!roomAdminMap[roomId]) {
      roomAdminMap[roomId] = socket.id;
      roomWritePermissions[roomId] = { [socket.id]: true };
      socket.join(roomId);

      const clients = getAllConnectedClients(roomId);
      io.to(socket.id).emit(ACTIONS.JOINED, {
        clients, username, socketId: socket.id, isAdmin: true, canWrite: true,
        code: roomCodeMap[roomId] || null,
        language: roomLanguageMap[roomId] || null,
      });
      return;
    }

    // Room exists — hold user in pending, notify admin
    if (!roomPendingRequests[roomId]) roomPendingRequests[roomId] = [];
    roomPendingRequests[roomId].push({ socketId: socket.id, username });

    io.to(roomAdminMap[roomId]).emit(ACTIONS.JOIN_REQUEST, { socketId: socket.id, username });
  });

  socket.on(ACTIONS.APPROVE_JOIN, ({ roomId, targetSocketId }) => {
    if (roomAdminMap[roomId] !== socket.id) return;
    if (roomPendingRequests[roomId]) {
      roomPendingRequests[roomId] = roomPendingRequests[roomId].filter(r => r.socketId !== targetSocketId);
    }
    const username = userSocketMap[targetSocketId];
    const targetSock = io.sockets.sockets.get(targetSocketId);
    if (!targetSock) return;
    targetSock.emit(ACTIONS.JOIN_APPROVED);
    admitUser(roomId, targetSocketId, username);
  });

  socket.on(ACTIONS.REJECT_JOIN, ({ roomId, targetSocketId }) => {
    if (roomAdminMap[roomId] !== socket.id) return;
    if (roomPendingRequests[roomId]) {
      roomPendingRequests[roomId] = roomPendingRequests[roomId].filter(r => r.socketId !== targetSocketId);
    }
    const targetSock = io.sockets.sockets.get(targetSocketId);
    if (targetSock) targetSock.emit(ACTIONS.JOIN_REJECTED, { message: 'Your request to join was denied by the admin.' });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    const isAdmin = roomAdminMap[roomId] === socket.id;
    const canWrite = isAdmin || (roomWritePermissions[roomId] && roomWritePermissions[roomId][socket.id] === true);
    if (!canWrite) {
      socket.emit(ACTIONS.PERMISSION_DENIED, { message: 'You do not have permission to write.' });
      return;
    }
    if (code !== null && code !== undefined) roomCodeMap[roomId] = code;
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    if (code !== null && code !== undefined) {
      const rooms = [...socket.rooms];
      const roomId = rooms.find(r => r !== socket.id);
      if (roomId) roomCodeMap[roomId] = code;
      io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    } else {
      const rooms = [...socket.rooms];
      const roomId = rooms.find(r => r !== socket.id);
      if (roomId && roomCodeMap[roomId]) io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code: roomCodeMap[roomId] });
    }
  });

  socket.on(ACTIONS.TOGGLE_WRITE, ({ roomId, targetSocketId }) => {
    if (roomAdminMap[roomId] !== socket.id) return;
    if (!roomWritePermissions[roomId]) roomWritePermissions[roomId] = {};
    // Actually toggle the permission
    roomWritePermissions[roomId][targetSocketId] = !roomWritePermissions[roomId][targetSocketId];
    const newCanWrite = roomWritePermissions[roomId][targetSocketId];
    const targetSock = io.sockets.sockets.get(targetSocketId);
    if (targetSock && targetSock.rooms.has(roomId)) {
      targetSock.emit(ACTIONS.PERMISSION_UPDATED, { canWrite: newCanWrite });
    }
    io.to(roomId).emit(ACTIONS.CLIENTS_UPDATED, { clients: getAllConnectedClients(roomId) });
  });

  socket.on(ACTIONS.KICK_USER, ({ roomId, targetSocketId }) => {
    if (roomAdminMap[roomId] !== socket.id) return;
    const targetSock = io.sockets.sockets.get(targetSocketId);
    if (targetSock && targetSock.rooms.has(roomId)) {
      const kickedUsername = userSocketMap[targetSocketId] || 'Unknown';
      targetSock.leave(roomId);
      targetSock.emit(ACTIONS.USER_KICKED, { message: 'You have been kicked from the room by the admin.' });
      delete userSocketMap[targetSocketId];
      if (roomWritePermissions[roomId]) delete roomWritePermissions[roomId][targetSocketId];
      io.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: targetSocketId, username: kickedUsername, clients: getAllConnectedClients(roomId),
      });
    }
  });

  // Language change — only users with write permission can change
  socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, languageId, code }) => {
    const isAdmin = roomAdminMap[roomId] === socket.id;
    const canWrite = isAdmin || (roomWritePermissions[roomId] && roomWritePermissions[roomId][socket.id] === true);
    if (!canWrite) {
      socket.emit(ACTIONS.PERMISSION_DENIED, { message: 'You do not have permission to change the language.' });
      return;
    }
    roomLanguageMap[roomId] = languageId;
    if (code !== undefined && code !== null) roomCodeMap[roomId] = code;
    // Broadcast to everyone else in the room
    socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { languageId, code });
  });

  // File share — broadcast file to all others in room, store in room state
  socket.on(ACTIONS.FILE_SHARE, ({ roomId, file }) => {
    if (!roomFilesMap[roomId]) roomFilesMap[roomId] = [];
    roomFilesMap[roomId].push(file);
    // Broadcast to everyone else
    socket.in(roomId).emit(ACTIONS.FILE_SHARE, { file });
  });

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // Remove from pending if they disconnect while waiting
      if (roomPendingRequests[roomId]) {
        roomPendingRequests[roomId] = roomPendingRequests[roomId].filter(r => r.socketId !== socket.id);
      }

      const wasAdmin = roomAdminMap[roomId] === socket.id;
      if (wasAdmin) {
        const remaining = getAllConnectedClients(roomId).filter(c => c.socketId !== socket.id);
        if (remaining.length > 0) {
          roomAdminMap[roomId] = remaining[0].socketId;
          if (roomWritePermissions[roomId]) roomWritePermissions[roomId][remaining[0].socketId] = true;
        } else {
          delete roomAdminMap[roomId];
          delete roomCodeMap[roomId];
          delete roomLanguageMap[roomId];
          delete roomWritePermissions[roomId];
          delete roomPendingRequests[roomId];
          delete roomFilesMap[roomId];
        }
      }

      const updatedClients = getAllConnectedClients(roomId).filter(c => c.socketId !== socket.id);
      socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id, username: userSocketMap[socket.id], clients: updatedClients,
      });

      if (wasAdmin && updatedClients.length > 0) {
        io.to(updatedClients[0].socketId).emit(ACTIONS.JOINED, {
          clients: updatedClients,
          username: userSocketMap[updatedClients[0].socketId],
          socketId: updatedClients[0].socketId,
          isAdmin: true,
        });
      }
    });
    delete userSocketMap[socket.id];
  });
});

async function connectToMongo() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(MONGO_DB_NAME);
  downloadsCollection = db.collection('downloads');
  console.log(`Connected to MongoDB database "${MONGO_DB_NAME}"`);
}

const PORT = process.env.PORT || 5000;
connectToMongo()
  .catch((err) => console.error('Failed to connect to MongoDB. Download logging will be unavailable.', err))
  .finally(() => server.listen(PORT, () => console.log(`Server running on port ${PORT}`)));
