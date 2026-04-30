import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';

import initSocket from './socketserv.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { getMyConversations } from './controllers/messageController.js';
import authRoutes from './routes/authRoutes.js';
import messageRoutes from './routes/routes_messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: `http://localhost:${PORT}`,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

initSocket(io);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Pages HTML
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'auth.html'));
});

app.get('/message_page', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'message_page.html'));
});
app.get('/conversation', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'conversation.html'));
});
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Gestion erreurs
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

server.listen(PORT, () => {
  console.log(`S.E.M.W.A running on http://localhost:${PORT}`);
});