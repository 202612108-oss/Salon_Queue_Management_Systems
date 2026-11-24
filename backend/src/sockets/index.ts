import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'node:http';
import { SOCKET_EVENTS } from '@salon/shared';

let ioInstance: SocketIOServer | null = null;

export function setupSocketIO(server: HTTPServer): SocketIOServer {
  const corsOriginEnv = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*';
  const allowedOrigins = corsOriginEnv === '*'
    ? '*'
    : corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);

  const io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet.');
  }
  return ioInstance;
}
