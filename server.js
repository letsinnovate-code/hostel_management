const http = require('http');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const connectDB = require('./src/config/database');
// Alert & Automation Module
const { initAlertModule, shutdownAlertModule } = require('./src/modules/alert');

// Load env vars
dotenv.config();

// Environment validation
const requiredEnv = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    console.error(`[FATAL] Missing required production environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  } else {
    console.warn(`[WARN] Missing recommended environment variables: ${missingEnv.join(', ')}`);
  }
}

// Connect to database (for standalone server; serverless connects via middleware; skipped in test)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusColor = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : statusCode >= 300 ? '\x1b[36m' : '\x1b[32m';
    const resetColor = '\x1b[0m';
    console.log(`${statusColor}[${timestamp}] ${method} ${url} - ${statusCode} - ${duration}ms${resetColor}`);
  });

  next();
});

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Mobile apps, Postman, curl, direct navigation
  if (process.env.NODE_ENV !== 'production') return true;
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow any localhost/127.0.0.1 port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Allow all Vercel deployment preview and production domains
  try {
    const hostname = new URL(origin).hostname;
    if (hostname.endsWith('.vercel.app')) return true;
  } catch (parseErr) {
    // Malformed origin header URL cannot match vercel.app; intentionally ignored
  }
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global API rate limiter (protects against general DDoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Database connection & environment validation middleware (handles Serverless cold starts)
app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS' || req.path === '/' || req.path === '/api/health' || req.path === '/favicon.ico') {
    return next();
  }

  if (process.env.VERCEL && missingEnv.length > 0) {
    return res.status(500).json({
      success: false,
      message: `Missing required environment variables on Vercel: ${missingEnv.join(', ')}. Please configure them in Vercel Project Settings > Environment Variables.`,
    });
  }

  try {
    if (mongoose.connection.readyState !== 1 && process.env.NODE_ENV !== 'test') {
      await connectDB();
    }
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to MongoDB database.',
      error: err.message,
      hint: 'Verify MONGODB_URI in Vercel settings and ensure MongoDB Atlas Network Access allows 0.0.0.0/0 (Allow access from anywhere).'
    });
  }
});

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/public', require('./src/routes/publicRoutes'));
app.use('/api/owner', require('./src/routes/ownerRoutes'));
app.use('/api/warden', require('./src/routes/wardenRoutes'));
app.use('/api/cleaner', require('./src/routes/cleanerRoutes'));
app.use('/api/student', require('./src/routes/studentRoutes'));
app.use('/api/security', require('./src/routes/securityRoutes'));
app.use('/api/superadmin', require('./src/routes/superadminRoutes'));
// Hostel Alert & Automation Module routes
app.use('/api/alerts', require('./src/modules/alert/routes/alertRoutes'));
// Student Onboarding & Verification Module routes
app.use('/api/onboarding', require('./src/routes/onboardingRoutes'));

// Production-grade Health Check (readiness & liveness)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbHealthy = dbState === 1;
  const status = isDbHealthy ? 'healthy' : 'degraded';
  const statusCode = isDbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: isDbHealthy ? 'connected' : (dbState === 2 ? 'connecting' : 'disconnected'),
      readyState: dbState,
    },
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    },
  });
});

// Payment & Razorpay routes (moved to dedicated payment module)
app.use('/api', require('./src/routes/paymentRoutes'));

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Hostel Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      owner: '/api/owner',
      warden: '/api/warden',
      cleaner: '/api/cleaner',
      student: '/api/student',
      onboarding: '/api/onboarding',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  console.error(`[${timestamp}] ERROR ${method} ${url}:`, {
    name: err.name,
    code: err.code,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    statusCode: err.statusCode,
  });

  // Mongoose CastError (invalid ObjectId / invalid type cast) -> 400 Bad Request
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ID',
      message: `Invalid identifier format for field '${err.path}'`,
    });
  }

  // MongoDB Duplicate Key Error -> 409 Conflict
  if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'resource';
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_RESOURCE',
      message: `A record with this ${field} already exists.`,
    });
  }

  // Mongoose Schema Validation Error -> 400 Bad Request
  if (err.name === 'ValidationError') {
    const errorDetails = err.errors
      ? Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
      : [];
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: err.message || 'Validation failed',
      errors: errorDetails.length > 0 ? errorDetails : undefined,
    });
  }

  // Multer Errors (e.g. file size exceeded) -> 413 or 400
  if (err.name === 'MulterError') {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({
      success: false,
      code: err.code || 'FILE_UPLOAD_ERROR',
      message: err.message || 'File upload error',
    });
  }

  // JWT Verification Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired authentication token',
    });
  }

  const statusCode = err.statusCode || 500;
  const safeMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : (err.message || 'Server Error');

  res.status(statusCode).json({
    success: false,
    code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
    message: safeMessage,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 4000;

// Create shared HTTP server (required for Socket.IO to work on same port as Express)
const server = http.createServer(app);

// Only start HTTP server when not on Vercel and not in test environment
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Accessible at:`);
    console.log(`  - http://localhost:${PORT}`);
    console.log(`  - http://127.0.0.1:${PORT}`);
    console.log(`  - http://192.168.1.6:${PORT} (network)`);
    // Initialize the Alert & Automation Module after server is listening
    await initAlertModule(server);
  });

  // Graceful shutdown — stop cron jobs, HTTP server, and database connection cleanly
  const gracefulShutdown = async (signal) => {
    console.log(`[Server] ${signal} received. Shutting down gracefully...`);
    try {
      shutdownAlertModule();
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await mongoose.connection.close(false);
          console.log('[Database] MongoDB connection closed cleanly.');
        } catch (dbErr) {
          console.error('[Database] Error closing MongoDB connection:', dbErr.message);
        }
        process.exit(signal === 'uncaughtException' ? 1 : 0);
      });

      // Safety timeout if handles remain open
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Process] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception thrown:', err);
    gracefulShutdown('uncaughtException');
  });
}

module.exports = app;
// Reload trigger for updated warden and curfew routes

