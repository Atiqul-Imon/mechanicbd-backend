import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // Basic Information
  paymentId: {
    type: String,
    unique: true,
    required: true
  },

  // Booking Reference
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

  // Payment Details
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1']
  },

  currency: {
    type: String,
    default: 'BDT',
    enum: ['BDT']
  },

  // Payment Method (Bangladesh Mobile Financial Services)
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['bkash', 'nagad', 'rocket', 'upay', 'tap', 'sure_cash']
  },

  // Payment Timing (Arogga-style)
  paymentTiming: {
    type: String,
    enum: ['before_service', 'after_service'],
    required: true
  },

  // Payment Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Transaction Details
  transactionId: {
    type: String,
    unique: true,
    sparse: true // Allow null/undefined values
  },

  // Mobile Financial Service Specific Fields
  mfsDetails: {
    senderNumber: {
      type: String,
      required: [true, 'Sender number is required']
    },
    receiverNumber: {
      type: String,
      required: [true, 'Receiver number is required']
    },
    transactionReference: String,
    counterNumber: String,
    storeId: String
  },

  // Payment Gateway Response
  gatewayResponse: {
    success: Boolean,
    message: String,
    code: String,
    timestamp: Date,
    rawResponse: mongoose.Schema.Types.Mixed
  },

  // Refund Information
  refund: {
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Timestamps
  paidAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      // Payment expires in 30 minutes
      return new Date(Date.now() + 30 * 60 * 1000);
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ booking: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ createdAt: -1 });

// Pre-save middleware to generate payment ID
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.paymentId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.paymentId = `PAY${year}${month}${day}${random}`;
  }
  next();
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Pending Payment',
    processing: 'Processing',
    completed: 'Payment Completed',
    failed: 'Payment Failed',
    cancelled: 'Payment Cancelled',
    refunded: 'Refunded'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for payment method display
paymentSchema.virtual('methodDisplay').get(function() {
  const methodMap = {
    bkash: 'bKash',
    nagad: 'Nagad',
    rocket: 'Rocket',
    upay: 'Upay',
    tap: 'Tap',
    sure_cash: 'Sure Cash'
  };
  return methodMap[this.paymentMethod] || this.paymentMethod;
});

// Method to check if payment is expired
paymentSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Method to check if payment can be refunded
paymentSchema.methods.canRefund = function() {
  return this.status === 'completed' && !this.refund.amount;
};

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 