import mongoose from 'mongoose';

const guestSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phoneNumber: {
    type: String,
    trim: true,
    maxlength: 20
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  location: {
    city: String,
    region: String,
    country: String
  },
  chatRooms: [{
    roomId: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7 * 24 * 60 * 60 // Auto-delete after 7 days
  }
}, {
  timestamps: true
});

// Index for performance
guestSchema.index({ sessionId: 1 });
guestSchema.index({ lastActivity: 1 });
guestSchema.index({ isActive: 1 });

// Method to update last activity
guestSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Method to add chat room
guestSchema.methods.addChatRoom = function(roomId) {
  const existingRoom = this.chatRooms.find(room => room.roomId === roomId);
  if (!existingRoom) {
    this.chatRooms.push({ roomId });
  }
  this.lastActivity = new Date();
  return this.save();
};

// Method to update room activity
guestSchema.methods.updateRoomActivity = function(roomId) {
  const room = this.chatRooms.find(r => r.roomId === roomId);
  if (room) {
    room.lastActivity = new Date();
    this.lastActivity = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to find active guests
guestSchema.statics.findActiveGuests = function() {
  return this.find({
    isActive: true,
    lastActivity: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Active in last 30 minutes
  });
};

// Static method to cleanup inactive sessions
guestSchema.statics.cleanupInactive = function() {
  return this.updateMany(
    {
      lastActivity: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Inactive for 24 hours
    },
    {
      $set: { isActive: false }
    }
  );
};

const Guest = mongoose.model('Guest', guestSchema);

export default Guest; 