import Guest from '../models/guest.model.js';
import { ChatRoom } from '../models/chat.model.js';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

// Rate limiting for guest creation
export const guestCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 guest sessions per windowMs
  message: 'Too many guest sessions created from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for guest messages
export const guestMessageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 messages per minute
  message: 'Too many messages sent, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Generate unique session ID
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip;
};

// Create or get guest session
export const createGuestSession = async (req, res) => {
  try {
    const { name, phoneNumber, email } = req.body;
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be at least 2 characters long'
      });
    }

    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Check if guest already exists for this IP
    let guest = await Guest.findOne({
      ipAddress: clientIP,
      isActive: true,
      lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Active in last 24 hours
    });

    if (guest) {
      // Update existing guest
      guest.name = name.trim();
      if (phoneNumber) guest.phoneNumber = phoneNumber.trim();
      if (email) guest.email = email.trim().toLowerCase();
      guest.lastActivity = new Date();
      await guest.save();

      return res.status(200).json({
        success: true,
        message: 'Guest session updated',
        data: {
          sessionId: guest.sessionId,
          name: guest.name,
          phoneNumber: guest.phoneNumber,
          email: guest.email
        }
      });
    }

    // Create new guest session
    const sessionId = generateSessionId();
    guest = new Guest({
      sessionId,
      name: name.trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      email: email ? email.trim().toLowerCase() : null,
      ipAddress: clientIP,
      userAgent
    });

    await guest.save();

    res.status(201).json({
      success: true,
      message: 'Guest session created successfully',
      data: {
        sessionId: guest.sessionId,
        name: guest.name,
        phoneNumber: guest.phoneNumber,
        email: guest.email
      }
    });

  } catch (error) {
    console.error('Error creating guest session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create guest session'
    });
  }
};

// Get guest session
export const getGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const guest = await Guest.findOne({
      sessionId,
      isActive: true
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest session not found or expired'
      });
    }

    // Update last activity
    guest.lastActivity = new Date();
    await guest.save();

    res.status(200).json({
      success: true,
      data: {
        sessionId: guest.sessionId,
        name: guest.name,
        phoneNumber: guest.phoneNumber,
        email: guest.email,
        lastActivity: guest.lastActivity
      }
    });

  } catch (error) {
    console.error('Error getting guest session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get guest session'
    });
  }
};

// Update guest session
export const updateGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, phoneNumber, email } = req.body;

    const guest = await Guest.findOne({
      sessionId,
      isActive: true
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest session not found or expired'
      });
    }

    // Update fields if provided
    if (name && name.trim().length >= 2) {
      guest.name = name.trim();
    }
    if (phoneNumber !== undefined) {
      guest.phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    }
    if (email !== undefined) {
      guest.email = email ? email.trim().toLowerCase() : null;
    }

    guest.lastActivity = new Date();
    await guest.save();

    res.status(200).json({
      success: true,
      message: 'Guest session updated successfully',
      data: {
        sessionId: guest.sessionId,
        name: guest.name,
        phoneNumber: guest.phoneNumber,
        email: guest.email
      }
    });

  } catch (error) {
    console.error('Error updating guest session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update guest session'
    });
  }
};

// Deactivate guest session
export const deactivateGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const guest = await Guest.findOne({
      sessionId,
      isActive: true
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest session not found'
      });
    }

    guest.isActive = false;
    await guest.save();

    res.status(200).json({
      success: true,
      message: 'Guest session deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating guest session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate guest session'
    });
  }
};

// Get guest chat rooms
export const getGuestChatRooms = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const guest = await Guest.findOne({
      sessionId,
      isActive: true
    }).populate({
      path: 'chatRooms.roomId',
      model: 'ChatRoom',
      select: 'roomId title participants lastMessage lastActivity'
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest session not found or expired'
      });
    }

    // Update last activity
    guest.lastActivity = new Date();
    await guest.save();

    const rooms = guest.chatRooms.map(room => ({
      roomId: room.roomId.roomId,
      title: room.roomId.title,
      lastMessage: room.roomId.lastMessage,
      lastActivity: room.roomId.lastActivity,
      joinedAt: room.joinedAt
    }));

    res.status(200).json({
      success: true,
      data: {
        sessionId: guest.sessionId,
        name: guest.name,
        rooms
      }
    });

  } catch (error) {
    console.error('Error getting guest chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get guest chat rooms'
    });
  }
};

// Cleanup inactive sessions (cron job)
export const cleanupInactiveSessions = async () => {
  try {
    const result = await Guest.cleanupInactive();
    console.log(`Cleaned up ${result.modifiedCount} inactive guest sessions`);
  } catch (error) {
    console.error('Error cleaning up inactive sessions:', error);
  }
};

// Get guest statistics
export const getGuestStats = async (req, res) => {
  try {
    const totalGuests = await Guest.countDocuments();
    const activeGuests = await Guest.countDocuments({ isActive: true });
    const todayGuests = await Guest.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalGuests,
        active: activeGuests,
        today: todayGuests
      }
    });

  } catch (error) {
    console.error('Error getting guest stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get guest statistics'
    });
  }
}; 