// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server as SocketIoServer } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const server = http.createServer(app);

// Redis configuration for Socket.io scaling (optional)
let redis = null;

// Only configure Redis in development or if explicitly enabled
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_REDIS === 'true') {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true, // Don't connect immediately
      retryDelayOnClusterDown: 300,
      enableOfflineQueue: true, // Enable offline queue for better error handling
      connectTimeout: 5000, // 5 second timeout
      commandTimeout: 3000 // 3 second command timeout
    });
    
    redis.on('error', (err) => {
      console.log('Redis connection error (non-critical):', err.message);
      redis = null;
    });
    
    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
    
    redis.on('ready', () => {
      console.log('✅ Redis is ready');
    });
    
    redis.on('close', () => {
      console.log('Redis connection closed');
      redis = null;
    });
  } catch (error) {
    console.log('⚠️ Redis not available, continuing without Redis');
    redis = null;
  }
} else {
  console.log('ℹ️ Redis disabled in production (set ENABLE_REDIS=true to enable)');
}

// Socket.io with optional Redis adapter for horizontal scaling
const io = new SocketIoServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Redis adapter will be configured during server startup

// Import routes
import authRoutes from './routes/auth.route.js';
import userRoutes from './routes/users.route.js';
import serviceRoutes from './routes/services.route.js';
import bookingRoutes from './routes/bookings.route.js';
import paymentRoutes from './routes/payments.route.js';
import reviewRoutes from './routes/reviews.route.js';
import chatRoutes from './routes/chat.route.js';
import guestRoutes from './routes/guest.route.js';
import healthRoutes from './routes/health.route.js';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://mechanicbd-frontend.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/health', healthRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Mechanic BD API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_SET');
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join chat room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room ${roomId}`);
  });

  // Leave chat room
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.userId} left room ${roomId}`);
  });

  // Handle new message
  socket.on('send_message', (data) => {
    socket.to(data.roomId).emit('receive_message', {
      ...data,
      timestamp: new Date()
    });
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user_typing', {
      userId: socket.userId,
      roomId: data.roomId
    });
  });

  // Handle stop typing
  socket.on('stop_typing', (data) => {
    socket.to(data.roomId).emit('user_stop_typing', {
      userId: socket.userId,
      roomId: data.roomId
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mechanicbd');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Configure Redis adapter only if Redis is working
    if (redis) {
      try {
        // Test Redis connection
        await redis.ping();
        console.log('✅ Redis connection test successful');
        
        const { createAdapter } = await import('@socket.io/redis-adapter');
        const pubClient = redis;
        const subClient = redis.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.io Redis adapter configured');
      } catch (error) {
        console.log('⚠️ Redis connection failed:', error.message);
        console.log('⚠️ Socket.io running without Redis adapter');
      }
    } else {
      console.log('⚠️ Socket.io running without Redis adapter (Redis not available)');
    }
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();

