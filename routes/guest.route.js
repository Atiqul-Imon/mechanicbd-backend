import express from 'express';
import {
  createGuestSession,
  getGuestSession,
  updateGuestSession,
  deactivateGuestSession,
  getGuestChatRooms,
  getGuestStats,
  guestCreationLimiter,
  guestMessageLimiter
} from '../controllers/guest.controller.js';
import { restrictTo } from '../controllers/auth.controller.js';

const router = express.Router();

// Guest session management
router.post('/session', guestCreationLimiter, createGuestSession);
router.get('/session/:sessionId', getGuestSession);
router.put('/session/:sessionId', guestCreationLimiter, updateGuestSession);
router.delete('/session/:sessionId', deactivateGuestSession);

// Guest chat rooms
router.get('/session/:sessionId/rooms', getGuestChatRooms);

// Admin only - guest statistics
router.get('/stats', restrictTo(['admin']), getGuestStats);

export default router; 