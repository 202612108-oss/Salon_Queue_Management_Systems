import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { initDatabase } from './db/index.js';
import { setupSocketIO } from './sockets/index.js';
import apiRouter from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS origin configuration
const corsOriginEnv = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOriginEnv === '*'
  ? '*'
  : corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Routes
app.use('/api', apiRouter);

// Root greeting / sanity check
app.get('/', (_req, res) => {
  res.json({
    name: 'Salon Queue Management System API',
    status: 'running',
    healthEndpoint: '/api/health'
  });
});

// Initialize database
initDatabase();

// Create HTTP Server & Socket.IO
const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
  console.log(`[Backend] Health check endpoint: /api/health`);
});
