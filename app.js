// C:\Users\samyb\StudioProjects\web_S.E.M.W.A\app.js
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';

import initSocket from './socketserv.js';
import authRoutes from './routes/authRoutes.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import adminRoutes from './routes/adminRoutes.js';
import messageRoutes from './routes/routes_messages.js';
import searchRoutes from './routes/routes_search.js';
import eventRoutes     from './routes/eventRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialisation Socket.io
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
app.use('/api/auth',     authRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search',   searchRoutes);
app.use('/api/events',    eventRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Pages HTML
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'auth.html'));
});
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'admin.html'));
});
app.get('/message_page', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'message_page.html'));
});
app.get('/conversation', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'conversation.html'));
});
app.get('/search', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'search.html'));
});
app.get('/result', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'result.html'));
});
app.get('/acceuil', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'acceuil.html'));
});
app.get('/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard.html'));
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Erreurs globales
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

server.listen(PORT, () => {
  console.log(`S.E.M.W.A running on http://localhost:${PORT}`);
});