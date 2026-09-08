const http = require('http');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
// Alert & Automation Module
const { initAlertModule, shutdownAlertModule } = require('./modules/alert');

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

// Connect to database (for standalone server; serverless connects via middleware)
if (!process.env.VERCEL) {
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
  } catch (_) {}
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
    if (mongoose.connection.readyState !== 1) {
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
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/owner', require('./routes/ownerRoutes'));
app.use('/api/warden', require('./routes/wardenRoutes'));
app.use('/api/cleaner', require('./routes/cleanerRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/security', require('./routes/securityRoutes'));
app.use('/api/superadmin', require('./routes/superadminRoutes'));
// Hostel Alert & Automation Module routes
app.use('/api/alerts', require('./modules/alert/routes/alertRoutes'));

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

// Razorpay checkout page (for mobile WebView – uses callback_url + redirect for WebView compatibility)
app.get('/api/razorpay-checkout', (req, res) => {
  const orderId = (req.query.order_id || '').toString().trim();
  const keyId = (req.query.key_id || '').toString().trim();
  const amountINR = Number(req.query.amount) || 0;
  const name = (req.query.name || 'Hostel Payment').toString().replace(/[<>"']/g, '');
  const description = (req.query.description || 'Payment').toString().replace(/[<>"']/g, '');
  const callbackUrl = (req.query.callback_url || '').toString().trim();
  if (!orderId || !keyId || amountINR < 1) {
    res.status(400).send('<html><body><p>Missing or invalid parameters (order_id, key_id, amount required).</p></body></html>');
    return;
  }
  if (!callbackUrl) {
    res.status(400).send('<html><body><p>Missing callback_url (required for WebView).</p></body></html>');
    return;
  }
  const amountPaise = Math.round(amountINR * 100);
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <p id="msg">Opening payment...</p>
  <button id="btn" style="display:none; padding:12px 24px; font-size:16px; background:#0c2458; color:#fff; border:none; border-radius:8px; cursor:pointer;">Pay ₹${amountINR.toLocaleString()}</button>
  <script>
    (function() {
      var orderId = ${JSON.stringify(orderId)};
      var keyId = ${JSON.stringify(keyId)};
      var amountPaise = ${amountPaise};
      var name = ${JSON.stringify(name)};
      var description = ${JSON.stringify(description)};
      var callbackUrl = ${JSON.stringify(callbackUrl)};
      var options = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        order_id: orderId,
        name: name,
        description: description,
        callback_url: callbackUrl,
        redirect: true
      };
      function openCheckout() {
        try {
          var rzp = new Razorpay(options);
          rzp.open();
        } catch (e) {
          document.getElementById('msg').textContent = 'Error: ' + (e.message || 'Could not open payment');
          document.getElementById('btn').style.display = 'block';
          document.getElementById('btn').onclick = function() { openCheckout(); };
        }
      }
      if (window.Razorpay) {
        openCheckout();
      } else {
        document.getElementById('msg').textContent = 'Loading Razorpay...';
        document.getElementById('btn').style.display = 'block';
        document.getElementById('btn').onclick = function() {
          if (window.Razorpay) openCheckout();
          else document.getElementById('msg').textContent = 'Failed to load. Use "Pay in browser" from the app.';
        };
        setTimeout(function() { if (window.Razorpay) openCheckout(); }, 1500);
      }
    })();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Razorpay callback (POST from Razorpay redirect – used when redirect:true in checkout)
const Payment = require('./models/Payment');
const Plan = require('./models/Plan');
const { verifyPaymentSignature } = require('./utils/razorpay');
const { setPeriodFromPlan } = require('./utils/paymentPeriod');
app.post('/api/razorpay-callback', (req, res) => {
  const razorpay_order_id = (req.body && req.body.razorpay_order_id) || (req.query && req.query.razorpay_order_id);
  const razorpay_payment_id = (req.body && req.body.razorpay_payment_id) || (req.query && req.query.razorpay_payment_id);
  const razorpay_signature = (req.body && req.body.razorpay_signature) || (req.query && req.query.razorpay_signature);
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).set('Content-Type', 'text/html').send(
      '<!DOCTYPE html><html><body><p>Missing payment details.</p></body></html>'
    );
  }
  const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) {
    return res.status(400).set('Content-Type', 'text/html').send(
      '<!DOCTYPE html><html><body><p>Invalid signature.</p></body></html>'
    );
  }
  Payment.findOne({ razorpayOrderId: razorpay_order_id })
    .then(async (payment) => {
      if (!payment) {
        return res.status(404).set('Content-Type', 'text/html').send(
          '<!DOCTYPE html><html><body><p>Payment not found.</p></body></html>'
        );
      }
      if (payment.status === 'paid') {
        return sendSuccessHtml(res);
      }
      payment.status = 'paid';
      payment.transactionId = razorpay_payment_id;
      payment.paymentMethod = 'upi';
      payment.paidDate = new Date();
      if (payment.planId) {
        const plan = await Plan.findById(payment.planId).select('durationMonths').lean();
        if (plan && plan.durationMonths) setPeriodFromPlan(payment, payment.paidDate, plan.durationMonths);
      }
      return payment.save().then(() => sendSuccessHtml(res));
    })
    .catch((err) => {
      console.error('Razorpay callback error:', err);
      res.status(500).set('Content-Type', 'text/html').send(
        '<!DOCTYPE html><html><body><p>Server error.</p></body></html>'
      );
    });
});

function sendSuccessHtml(res) {
  const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:sans-serif; padding:24px; text-align:center;">
  <h2 style="color:#059669;">Payment successful</h2>
  <p>You can close this window and return to the app.</p>
  <script>
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ success: true }));
    }
  </script>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

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
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  console.error(`[${timestamp}] ERROR ${method} ${url}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    statusCode: err.statusCode || 500,
  });

  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const safeMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : (err.message || 'Server Error');

  res.status(statusCode).json({
    success: false,
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

// Only start HTTP server when not on Vercel (serverless handles requests via export)
if (!process.env.VERCEL) {
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

