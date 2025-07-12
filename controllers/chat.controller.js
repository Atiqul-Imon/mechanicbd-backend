import { ChatRoom, Message } from '../models/chat.model.js';
import Guest from '../models/guest.model.js';
import User from '../models/user.model.js';

// Create support chat (for guests and registered users)
export const createSupportChat = async (req, res) => {
  try {
    const { issue, category = 'general' } = req.body;
    const userId = req.user?._id;
    const sessionId = req.body.sessionId; // For guests

    if (!issue || issue.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Issue description must be at least 10 characters long'
      });
    }

    let participant;
    let roomTitle;

    if (userId) {
      // Registered user
      participant = await User.findById(userId);
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      roomTitle = `Support - ${participant.fullName}`;
    } else if (sessionId) {
      // Guest user
      participant = await Guest.findOne({ sessionId, isActive: true });
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Guest session not found or expired'
        });
      }
      roomTitle = `Support - ${participant.name}`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'User ID or session ID is required'
      });
    }

    // Check if support chat already exists
    const existingRoom = await ChatRoom.findOne({
      'participants.user': participant._id,
      type: 'support',
      isActive: true
    });

    if (existingRoom) {
      return res.status(200).json({
        success: true,
        message: 'Support chat already exists',
        data: {
          roomId: existingRoom.roomId,
          title: existingRoom.title
        }
      });
    }

    // Create new support chat room
    const roomId = `support_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const supportRoom = new ChatRoom({
      roomId,
      title: roomTitle,
      type: 'support',
      category,
      participants: [{
        user: participant._id,
        role: 'customer',
        joinedAt: new Date()
      }],
      metadata: {
        issue,
        category,
        createdAt: new Date()
      }
    });

    await supportRoom.save();

    // Add room to guest's chat rooms if guest
    if (sessionId) {
      await participant.addChatRoom(roomId);
    }

    res.status(201).json({
      success: true,
      message: 'Support chat created successfully',
      data: {
        roomId: supportRoom.roomId,
        title: supportRoom.title,
        category
      }
    });

  } catch (error) {
    console.error('Error creating support chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support chat'
    });
  }
};

// Get chat rooms (for both registered users and guests)
export const getChatRooms = async (req, res) => {
  try {
    const userId = req.user?._id;
    const sessionId = req.query.sessionId; // For guests

    let rooms = [];

    if (userId) {
      // Registered user
      rooms = await ChatRoom.find({
        'participants.user': userId,
        isActive: true
      }).populate('participants.user', 'fullName email profilePhoto')
        .populate('lastMessage.sender', 'fullName')
        .sort({ lastActivity: -1 })
        .limit(50); // Limit for performance
    } else if (sessionId) {
      // Guest user
      const guest = await Guest.findOne({ sessionId, isActive: true });
      if (!guest) {
        return res.status(404).json({
          success: false,
          message: 'Guest session not found or expired'
        });
      }

      rooms = await ChatRoom.find({
        'participants.user': guest._id,
        isActive: true
      }).populate('participants.user', 'name email')
        .populate('lastMessage.sender', 'name')
        .sort({ lastActivity: -1 })
        .limit(20); // More restrictive for guests
    } else {
      return res.status(400).json({
        success: false,
        message: 'User ID or session ID is required'
      });
    }

    const formattedRooms = rooms.map(room => ({
      roomId: room.roomId,
      title: room.title,
      type: room.type,
      category: room.category,
      lastMessage: room.lastMessage,
      lastActivity: room.lastActivity,
      participantCount: room.participants.length,
      unreadCount: 0 // Will be calculated separately if needed
    }));

    res.status(200).json({
      success: true,
      data: formattedRooms
    });

  } catch (error) {
    console.error('Error getting chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat rooms'
    });
  }
};

// Get messages for a room (optimized for performance)
export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?._id;
    const sessionId = req.query.sessionId;

    // Verify user has access to this room
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (sessionId) {
      user = await Guest.findOne({ sessionId, isActive: true });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or session expired'
      });
    }

    const room = await ChatRoom.findOne({
      roomId,
      'participants.user': user._id,
      isActive: true
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found or access denied'
      });
    }

    // Get messages with pagination
    const skip = (page - 1) * limit;
    const messages = await Message.find({ roomId })
      .populate('sender', 'fullName name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean for better performance

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({ roomId });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(), // Show oldest first
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalMessages,
          pages: Math.ceil(totalMessages / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages'
    });
  }
};

// Send message (with rate limiting for guests)
export const sendMessage = async (req, res) => {
  try {
    const { roomId, content } = req.body;
    const userId = req.user?._id;
    const sessionId = req.body.sessionId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Rate limiting check for guests
    if (sessionId) {
      const guest = await Guest.findOne({ sessionId, isActive: true });
      if (!guest) {
        return res.status(401).json({
          success: false,
          message: 'Guest session expired'
        });
      }

      // Simple rate limiting: max 20 messages per hour for guests
      const recentMessages = await Message.countDocuments({
        sender: guest._id,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      });

      if (recentMessages >= 20) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Please slow down.'
        });
      }
    }

    // Verify user has access to this room
    let sender;
    if (userId) {
      sender = await User.findById(userId);
    } else if (sessionId) {
      sender = await Guest.findOne({ sessionId, isActive: true });
    }

    if (!sender) {
      return res.status(401).json({
        success: false,
        message: 'User not found or session expired'
      });
    }

    const room = await ChatRoom.findOne({
      roomId,
      'participants.user': sender._id,
      isActive: true
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found or access denied'
      });
    }

    // Create message
    const message = new Message({
      roomId,
      sender: sender._id,
      content: content.trim(),
      messageType: 'text'
    });

    await message.save();

    // Update room's last message and activity
    room.lastMessage = {
      content: message.content,
      sender: sender._id,
      timestamp: message.createdAt
    };
    room.lastActivity = new Date();
    await room.save();

    // Update guest activity if guest
    if (sessionId) {
      await sender.updateRoomActivity(roomId);
    }

    // Populate sender info for response
    await message.populate('sender', 'fullName name profilePhoto');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Join chat room
export const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?._id;
    const sessionId = req.body.sessionId;

    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (sessionId) {
      user = await Guest.findOne({ sessionId, isActive: true });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or session expired'
      });
    }

    const room = await ChatRoom.findOne({ roomId, isActive: true });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Check if user is already a participant
    const isParticipant = room.participants.some(p => p.user.toString() === user._id.toString());

    if (!isParticipant) {
      room.participants.push({
        user: user._id,
        role: 'customer',
        joinedAt: new Date()
      });
      await room.save();
    }

    // Add room to guest's chat rooms if guest
    if (sessionId) {
      await user.addChatRoom(roomId);
    }

    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        roomId: room.roomId,
        title: room.title
      }
    });

  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join room'
    });
  }
};

// Leave chat room
export const leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?._id;
    const sessionId = req.body.sessionId;

    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (sessionId) {
      user = await Guest.findOne({ sessionId, isActive: true });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or session expired'
      });
    }

    const room = await ChatRoom.findOne({ roomId, isActive: true });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Remove user from participants
    room.participants = room.participants.filter(p => p.user.toString() !== user._id.toString());
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Left room successfully'
    });

  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave room'
    });
  }
};

// Get chat statistics (admin only)
export const getChatStats = async (req, res) => {
  try {
    const totalRooms = await ChatRoom.countDocuments();
    const activeRooms = await ChatRoom.countDocuments({ isActive: true });
    const totalMessages = await Message.countDocuments();
    const todayMessages = await Message.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.status(200).json({
      success: true,
      data: {
        totalRooms,
        activeRooms,
        totalMessages,
        todayMessages
      }
    });

  } catch (error) {
    console.error('Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat statistics'
    });
  }
}; 