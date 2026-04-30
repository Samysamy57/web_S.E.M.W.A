import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
<<<<<<< HEAD
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
=======
import authRoutes from './routes/authRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
>>>>>>> 7d9a84a914d96001583e64e38b500f9fb7a0cc54

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

<<<<<<< HEAD
// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Pages HTML
=======
app.use('/api/auth', authRoutes);

>>>>>>> 7d9a84a914d96001583e64e38b500f9fb7a0cc54
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'auth.html'));
});

<<<<<<< HEAD
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
=======
>>>>>>> 7d9a84a914d96001583e64e38b500f9fb7a0cc54
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

<<<<<<< HEAD
server.listen(PORT, () => {
  console.log(`S.E.M.W.A running on http://localhost:${PORT}`);
});
=======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`S.E.M.W.A running on http://localhost:${PORT}`));
>>>>>>> 7d9a84a914d96001583e64e38b500f9fb7a0cc54
