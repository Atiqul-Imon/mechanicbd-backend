import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // Payment identification
  paymentId: {
    type: String,
    unique: true,
    required: [true, 'Payment ID is required']
  },

  // Related entities
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking is required']
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },

  mechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Mechanic is required']
  },

  // Payment details
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile_banking', 'bank_transfer', 'bkash', 'nagad', 'rocket', 'upay', 'tap', 'sure_cash'],
    required: [true, 'Payment method is required']
  },

  // Payment status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Payment timing (Arogga-style)
  paymentTiming: {
    type: String,
    enum: ['before_service', 'after_service'],
    default: 'before_service'
  },

  // MFS details
  mfsDetails: {
    senderNumber: {
      type: String,
      required: function() { return ['bkash', 'nagad', 'rocket', 'upay', 'tap', 'sure_cash'].includes(this.paymentMethod); }
    },
    receiverNumber: {
      type: String,
      required: function() { return ['bkash', 'nagad', 'rocket', 'upay', 'tap', 'sure_cash'].includes(this.paymentMethod); }
    },
    transactionId: String,
    transactionReference: String
  },

  // Payment details
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    gateway: String,
    gatewayResponse: {
      success: Boolean,
      message: String,
      code: String,
      timestamp: Date,
      rawResponse: mongoose.Schema.Types.Mixed
    }
  },

  // Timing
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from creation
    }
  },

  paidAt: {
    type: Date
  },

  // Refund information
  refund: {
    isRefunded: {
      type: Boolean,
      default: false
    },
    refundAmount: Number,
    refundReason: String,
    refundStatus: {
      type: String,
      enum: ['none', 'requested', 'approved', 'rejected', 'processed'],
      default: 'none'
    },
    refundedAt: Date,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Additional charges
  additionalCharges: [{
    description: String,
    amount: Number
  }],

  // Notes
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ customer: 1 });
paymentSchema.index({ mechanic: 1 });
paymentSchema.index({ booking: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ paymentId: 1 }, { unique: true });

// Instance method to check if payment is expired
paymentSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Instance method to check if payment can be refunded
paymentSchema.methods.canRefund = function() {
  return this.status === 'completed' && !this.refund.isRefunded;
};

// Pre-save middleware to generate payment ID
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.paymentId) {
    this.paymentId = `PAY${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

// Static method to get payment statistics
paymentSchema.statics.getStats = async function(filter = {}) {
  return await this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        refundedAmount: {
          $sum: { $cond: [{ $eq: ['$refund.isRefunded', true] }, '$refund.refundAmount', 0] }
        }
      }
    }
  ]);
};

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 