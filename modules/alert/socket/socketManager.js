/**
 * @file socketManager.js
 * @description Initialises and manages the Socket.IO server.
 *
 * WHY Socket.IO ON THE SAME HTTP SERVER:
 * Sharing the Express HTTP server with Socket.IO is the standard production
 * pattern. It avoids CORS complexity, works behind nginx/load balancers,
 * and reduces port management overhead.
 *
 * AUTHENTICATION:
 * Every socket connection must present a valid JWT. We validate it using
 * the same JWT_SECRET as the REST API. Unauthenticated sockets are
 * immediately disconnected. This prevents unauthorized clients from
 * subscribing to sensitive real-time events.
 *
 * ROOMS:
 * - `user:{userId}` — private channel per user (targeted alerts)
 * - `role:{role}:{hostelId}` — role + hostel channel (e.g. all wardens of hostel X)
 * - `hostel:{hostelId}` — all users in a hostel (broadcast events)
 * - `superadmin` — system-wide broadcast for super admins
 *
 * RECONNECTION:
 * Socket.IO handles reconnection automatically on the client side.
 * The server-side configuration uses a 30s ping interval to detect
 * stale connections and clean them up.
 */

'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const Hostel = require('../../../models/Hostel');
const { SOCKET_EVENTS } = require('../utils/constants');

let io = null;

/**
 * Initialize Socket.IO on the provided HTTP server.
 * Call this ONCE from server.js before server.listen().
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      // In production, restrict to your frontend domain
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Ping every 30s, disconnect if no pong within 5s
    // WHY: Aggressively clean up ghost connections in production
    pingInterval: 30000,
    pingTimeout: 5000,
    // Use websocket first, fall back to polling
    transports: ['websocket', 'polling'],
  });

  // ─── JWT Authentication Middleware ────────────────────────────────
  // Every incoming socket.io connection must pass this middleware.
  // The token can be in handshake.auth.token or handshake.query.token.
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('[SocketManager] CRITICAL: JWT_SECRET environment variable is not defined.');
        return next(new Error('Server configuration error'));
      }

      const decoded = jwt.verify(token, jwtSecret);
      const user = await User.findById(decoded.id).select('_id name role hostelId status').lean();

      if (!user || user.status !== 'active') {
        return next(new Error('User not found or inactive'));
      }

      // Attach user info to the socket for use in event handlers
      const roleRaw = user.role;
      socket.user = {
        ...user,
        id: String(user._id),
        role: Array.isArray(roleRaw) ? roleRaw[0] : String(roleRaw || ''),
        hostelId: user.hostelId ? String(user.hostelId) : null,
      };

      next();
    } catch (err) {
      console.error('[SocketManager] Auth failed:', err.message);
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Connection Handler ───────────────────────────────────────────
  io.on('connection', async (socket) => {
    const { id: userId, role, hostelId } = socket.user;

    console.log(`[Socket] Connected: user=${userId} role=${role} hostel=${hostelId}`);

    // Auto-join personal room
    socket.join(`user:${userId}`);
    const joinedRooms = [`user:${userId}`];

    // Auto-join role+hostel room (if hostelId present)
    if (hostelId) {
      socket.join(`role:${role}:${hostelId}`);
      socket.join(`hostel:${hostelId}`);
      joinedRooms.push(`role:${role}:${hostelId}`, `hostel:${hostelId}`);
    }

    // Owner auto-joins rooms for ALL hostels they own
    const isOwner = role === 'owner' || (Array.isArray(socket.user.role) && socket.user.role.includes('owner'));
    if (isOwner) {
      try {
        const owned = await Hostel.find({ ownerId: userId }).select('_id').lean();
        for (const h of owned) {
          const hid = String(h._id);
          socket.join(`role:owner:${hid}`);
          socket.join(`hostel:${hid}`);
          joinedRooms.push(`role:owner:${hid}`, `hostel:${hid}`);
        }
        console.log(`[Socket] Owner ${userId} joined rooms for ${owned.length} hostel(s)`);
      } catch (err) {
        console.error('[Socket] Failed to join owner hostel rooms:', err.message);
      }
    }

    // Superadmin gets global room
    if (role === 'superadmin') {
      socket.join('superadmin');
      joinedRooms.push('superadmin');
    }

    // Acknowledge connection with user room info
    socket.emit(SOCKET_EVENTS.CONNECTED, {
      message: 'Connected to Hostel Alert System',
      rooms: [...new Set(joinedRooms)],
    });

    // ─── Client-controlled room joins ────────────────────────────
    // Only permit joining rooms for hostels the user actually owns, administers, or is enrolled in
    socket.on(SOCKET_EVENTS.JOIN_HOSTEL_ROOM, async ({ hostelId: hId }) => {
      if (!hId) return;
      try {
        const targetHostelId = String(hId);
        if (role === 'superadmin') {
          socket.join(`hostel:${targetHostelId}`);
          console.log(`[Socket] Superadmin ${userId} joined hostel:${targetHostelId}`);
        } else if (isOwner) {
          const ownsHostel = await Hostel.exists({ _id: targetHostelId, ownerId: userId });
          if (ownsHostel) {
            socket.join(`hostel:${targetHostelId}`);
            socket.join(`role:owner:${targetHostelId}`);
            console.log(`[Socket] Owner ${userId} joined verified hostel:${targetHostelId}`);
          } else {
            console.warn(`[Socket SECURITY] Owner ${userId} denied joining unowned hostel:${targetHostelId}`);
          }
        } else if (hostelId && String(hostelId) === targetHostelId) {
          socket.join(`hostel:${targetHostelId}`);
          console.log(`[Socket] User ${userId} joined assigned hostel:${targetHostelId}`);
        } else {
          console.warn(`[Socket SECURITY] User ${userId} denied joining unauthorized hostel:${targetHostelId}`);
        }
      } catch (err) {
        console.error('[Socket] JOIN_HOSTEL_ROOM error:', err.message);
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ room }) => {
      if (!room) return;
      socket.leave(room);
    });

    // Health ping/pong
    socket.on(SOCKET_EVENTS.PING, () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ─── Disconnect cleanup ───────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: user=${userId} reason=${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket] Error for user=${userId}:`, err.message);
    });
  });

  console.log('[SocketManager] Socket.IO initialised successfully');
  return io;
}

/**
 * Get the initialized Socket.IO instance.
 * Throws if called before initSocket().
 *
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error('[SocketManager] Socket.IO not initialised. Call initSocket(httpServer) first.');
  }
  return io;
}

/**
 * Get the Socket.IO instance without throwing (returns null if not ready).
 * Use this in contexts where socket is optional (e.g. CLI scripts, tests).
 *
 * @returns {import('socket.io').Server|null}
 */
function getIOSafe() {
  return io;
}

module.exports = { initSocket, getIO, getIOSafe };
