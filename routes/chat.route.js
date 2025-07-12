import express, { Router } from 'express';
import {
  createSupportChat,
  getChatRooms,
  getMessages,
  sendMessage,
  joinRoom,
  leaveRoom,
  getChatStats
} from '../controllers/chat.controller.js';
import { protect } from '../controllers/auth.controller.js';

const chatRouter = Router();

// Apply authentication to all routes
chatRouter.use(protect);

// Chat room management
chatRouter.post('/rooms', joinRoom);
chatRouter.get('/rooms', getChatRooms);
chatRouter.delete('/rooms/:roomId', leaveRoom);

// Messages
chatRouter.get('/rooms/:roomId/messages', getMessages);
chatRouter.post('/rooms/:roomId/messages', sendMessage);

// Support chat
chatRouter.post('/support', createSupportChat);

// Chat statistics
chatRouter.get('/stats', getChatStats);

export default chatRouter; 