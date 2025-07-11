import express from 'express';

const router = express.Router();

// Health check endpoint for Render
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Mechanic BD API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router; 