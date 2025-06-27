import mongoose from 'mongoose';

console.log('Booking model file loaded');

const bookingSchema = new mongoose.Schema({
  // Basic Information
  bookingNumber: {
    type: String,
    unique: true
  },

  // Service and Mechanic
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service is required']
  },

  mechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Mechanic is required']
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },

  // Booking Details
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },

  scheduledTime: {
    type: String,
    required: [true, 'Scheduled time is required']
  },

  estimatedDuration: {
    type: Number, // in minutes
  },

  // Location
  serviceLocation: {
    address: {
      type: String,
      required: [true, 'Service address is required']
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    instructions: String
  },

  // Service Requirements
  serviceRequirements: [{
    type: String,
    trim: true
  }],

  customerNotes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },

  // Pricing
  basePrice: {
    type: Number,
    required: [true, 'Base price is required']
  },

  additionalCharges: [{
    description: String,
    amount: Number
  }],

  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required']
  },

  // Status and Lifecycle
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'confirmed'
  },

  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Scheduling
  actualStartTime: Date,
  actualEndTime: Date,
  actualDuration: Number, // in minutes

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },

  isPaid: {
    type: Boolean,
    default: false
  },

  paidAt: {
    type: Date
  },

  // Service completion tracking
  completedAt: {
    type: Date
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile_banking', 'bank_transfer'],
    default: 'cash'
  },

  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    gateway: String
  },

  // Cancellation
  cancellationReason: String,
  cancellationFee: Number,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,

  // Dispute
  disputeReason: String,
  disputeStatus: {
    type: String,
    enum: ['none', 'opened', 'under_review', 'resolved'],
    default: 'none'
  },
  disputeResolution: String,

  // Reviews and Ratings
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },

  customerReview: {
    type: String,
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },

  reviewDate: Date,

  // Communication
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],

  // Notifications
  notifications: [{
    type: {
      type: String,
      enum: ['status_update', 'payment', 'reminder', 'cancellation', 'dispute']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],

  // Rescheduling
  reschedule: {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: Date,
    oldDate: Date,
    oldTime: String,
    newDate: Date,
    newTime: String,
    status: {
      type: String,
      enum: ['none', 'requested', 'accepted', 'declined'],
      default: 'none'
    },
    respondedAt: Date,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String
  },

  // Refund
  refund: {
    isRefunded: { type: Boolean, default: false },
    refundAmount: Number,
    refundReason: String,
    refundStatus: {
      type: String,
      enum: ['none', 'requested', 'approved', 'rejected', 'processed'],
      default: 'none'
    },
    refundedAt: Date,
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
// Removed duplicate bookingNumber index
bookingSchema.index({ customer: 1 });
bookingSchema.index({ mechanic: 1 });
bookingSchema.index({ service: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ createdAt: -1 });

// Generate booking number before saving
bookingSchema.pre('save', async function (next) {
  console.log('Booking pre-save hook running. isNew:', this.isNew, 'Current bookingNumber:', this.bookingNumber);
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // Get count of bookings for today
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const count = await mongoose.model('Booking').countDocuments({
      createdAt: { $gte: todayStart, $lt: todayEnd }
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    this.bookingNumber = `MB${year}${month}${day}${sequence}`;
    console.log('Generated bookingNumber:', this.bookingNumber);
  }

  // Add status to history when status changes
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.status === 'pending' ? this.customer : this.mechanic
    });
  }

  next();
});

// Virtual for additional charges total
bookingSchema.virtual('additionalChargesTotal').get(function () {
  return this.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
});

// Virtual for isOverdue
bookingSchema.virtual('isOverdue').get(function () {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  const scheduledDateTime = new Date(this.scheduledDate);
  scheduledDateTime.setHours(parseInt(this.scheduledTime.split(':')[0]));
  scheduledDateTime.setMinutes(parseInt(this.scheduledTime.split(':')[1]));
  return new Date() > scheduledDateTime;
});

// Ensure virtual fields are serialized
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
