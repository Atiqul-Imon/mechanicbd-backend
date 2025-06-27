// server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import config from './config/env.js';
import authRouter from './routes/auth.route..js';
import serviceRouter from './routes/services.route.js';
import bookingRouter from './routes/bookings.route.js'; 
import userRouter from './routes/users.route.js';
import reviewRouter from './routes/reviews.route.js';
import paymentRouter from './routes/payments.route.js';

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/services', serviceRoutes);
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/users', userRoutes);

app.use("/api/auth", authRouter); 
app.use("/api/services", serviceRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/users', userRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/payments', paymentRouter);

// MongoDB connection
mongoose.connect(config.MONGO_URI)
  .then(() => {
    console.log('MongoDB Atlas connected');
    app.listen(config.PORT, () => {
      console.log(`Server is running on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });

