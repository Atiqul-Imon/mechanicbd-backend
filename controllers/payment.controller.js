import Payment from '../models/payment.model.js';
import Booking from '../models/booking.model.js';
import User from '../models/user.model.js';

// Mock MFS API configurations (replace with real credentials later)
const MFS_CONFIG = {
  bkash: {
    name: 'bKash',
    receiverNumber: '01712345678',
    apiKey: 'mock_bkash_api_key',
    secretKey: 'mock_bkash_secret_key',
    sandbox: true
  },
  nagad: {
    name: 'Nagad',
    receiverNumber: '01712345678',
    apiKey: 'mock_nagad_api_key',
    secretKey: 'mock_nagad_secret_key',
    sandbox: true
  },
  rocket: {
    name: 'Rocket',
    receiverNumber: '01712345678',
    apiKey: 'mock_rocket_api_key',
    secretKey: 'mock_rocket_secret_key',
    sandbox: true
  },
  upay: {
    name: 'Upay',
    receiverNumber: '01712345678',
    apiKey: 'mock_upay_api_key',
    secretKey: 'mock_upay_secret_key',
    sandbox: true
  },
  tap: {
    name: 'Tap',
    receiverNumber: '01712345678',
    apiKey: 'mock_tap_api_key',
    secretKey: 'mock_tap_secret_key',
    sandbox: true
  },
  sure_cash: {
    name: 'Sure Cash',
    receiverNumber: '01712345678',
    apiKey: 'mock_sure_cash_api_key',
    secretKey: 'mock_sure_cash_secret_key',
    sandbox: true
  }
};

// Create a new payment (Arogga-style: can be created anytime after booking)
export const createPayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod, senderNumber } = req.body;
    const customerId = req.user.id;

    // Validate booking exists and belongs to customer
    const booking = await Booking.findById(bookingId)
      .populate('service', 'title basePrice')
      .populate('mechanic', 'fullName phoneNumber');

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    if (booking.customer.toString() !== customerId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only pay for your own bookings'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot pay for cancelled bookings'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ booking: bookingId });
    if (existingPayment) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment already exists for this booking'
      });
    }

    // Validate payment method
    if (!MFS_CONFIG[paymentMethod]) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payment method'
      });
    }

    // Validate sender number format (Bangladesh mobile number)
    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(senderNumber)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid phone number format'
      });
    }

    // Determine payment timing (Arogga-style)
    const paymentTiming = booking.status === 'completed' 
      ? 'after_service' 
      : 'before_service';

    // Create payment record
    const payment = await Payment.create({
      booking: bookingId,
      customer: customerId,
      mechanic: booking.mechanic._id,
      amount: booking.totalAmount,
      paymentMethod,
      paymentTiming,
      mfsDetails: {
        senderNumber,
        receiverNumber: MFS_CONFIG[paymentMethod].receiverNumber
      }
    });

    // Populate related data
    await payment.populate([
      { path: 'booking', populate: { path: 'service', select: 'title' } },
      { path: 'customer', select: 'fullName phoneNumber' },
      { path: 'mechanic', select: 'fullName phoneNumber' }
    ]);

    res.status(201).json({
      status: 'success',
      data: {
        payment,
        paymentInstructions: {
          method: paymentMethod,
          receiverNumber: MFS_CONFIG[paymentMethod].receiverNumber,
          amount: payment.amount,
          expiresAt: payment.expiresAt,
          timing: paymentTiming
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating payment',
      error: error.message
    });
  }
};

// Process payment verification (Arogga-style: updates booking payment status)
export const verifyPayment = async (req, res) => {
  try {
    const { paymentId, transactionId, transactionReference } = req.body;
    const customerId = req.user.id;

    // Find payment
    const payment = await Payment.findOne({ paymentId, customer: customerId })
      .populate('booking', 'status totalAmount paymentStatus')
      .populate('customer', 'fullName phoneNumber')
      .populate('mechanic', 'fullName phoneNumber');

    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }

    if (payment.status === 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Payment already completed'
      });
    }

    if (payment.isExpired()) {
      payment.status = 'cancelled';
      await payment.save();
      return res.status(400).json({
        status: 'error',
        message: 'Payment has expired'
      });
    }

    // Mock MFS verification (replace with real API call)
    const verificationResult = await mockMFSVerification(
      payment.paymentMethod,
      transactionId,
      transactionReference,
      payment.amount
    );

    if (verificationResult.success) {
      // Update payment status
      payment.status = 'completed';
      payment.transactionId = transactionId;
      payment.mfsDetails.transactionReference = transactionReference;
      payment.paidAt = new Date();
      payment.gatewayResponse = {
        success: true,
        message: 'Payment verified successfully',
        code: 'SUCCESS',
        timestamp: new Date(),
        rawResponse: verificationResult
      };

      await payment.save();

      // Update booking payment status (Arogga-style)
      await Booking.findByIdAndUpdate(payment.booking._id, {
        paymentStatus: 'paid',
        isPaid: true,
        paidAt: new Date()
      });

      res.status(200).json({
        status: 'success',
        message: 'Payment verified successfully',
        data: {
          payment,
          booking: {
            id: payment.booking._id,
            paymentStatus: 'paid'
          }
        }
      });
    } else {
      // Payment verification failed
      payment.status = 'failed';
      payment.gatewayResponse = {
        success: false,
        message: verificationResult.message || 'Payment verification failed',
        code: 'VERIFICATION_FAILED',
        timestamp: new Date(),
        rawResponse: verificationResult
      };

      await payment.save();

      res.status(400).json({
        status: 'error',
        message: verificationResult.message || 'Payment verification failed',
        data: { payment }
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

// Get payment details
export const getPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const customerId = req.user.id;

    const payment = await Payment.findOne({ paymentId, customer: customerId })
      .populate('booking', 'bookingNumber status totalAmount serviceLocation scheduledDate scheduledTime')
      .populate('customer', 'fullName phoneNumber')
      .populate('mechanic', 'fullName phoneNumber');

    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { payment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// Get user's payment history
export const getUserPayments = async (req, res) => {
  try {
    const customerId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { customer: customerId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;

    const payments = await Payment.find(filter)
      .populate('booking', 'bookingNumber status totalAmount')
      .populate('mechanic', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: payments.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: { payments }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// Cancel payment
export const cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const customerId = req.user.id;

    const payment = await Payment.findOne({ paymentId, customer: customerId });

    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Only pending payments can be cancelled'
      });
    }

    payment.status = 'cancelled';
    await payment.save();

    res.status(200).json({
      status: 'success',
      message: 'Payment cancelled successfully',
      data: { payment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error cancelling payment',
      error: error.message
    });
  }
};

// Admin: Process refund
export const processRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, amount } = req.body;
    const adminId = req.user.id;

    const payment = await Payment.findById(paymentId)
      .populate('customer', 'fullName phoneNumber')
      .populate('booking', 'bookingNumber');

    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }

    if (!payment.canRefund()) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment cannot be refunded'
      });
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Refund amount cannot exceed payment amount'
      });
    }

    // Mock refund processing (replace with real MFS API call)
    const refundResult = await mockRefundProcessing(
      payment.paymentMethod,
      payment.transactionId,
      refundAmount
    );

    if (refundResult.success) {
      payment.status = 'refunded';
      payment.refund = {
        amount: refundAmount,
        reason,
        processedAt: new Date(),
        processedBy: adminId
      };

      await payment.save();

      res.status(200).json({
        status: 'success',
        message: 'Refund processed successfully',
        data: { payment }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: refundResult.message || 'Refund processing failed',
        data: { payment }
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// Admin: Get all payments
export const adminGetAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;
    if (req.query.customer) filter.customer = req.query.customer;

    const payments = await Payment.find(filter)
      .populate('customer', 'fullName phoneNumber')
      .populate('mechanic', 'fullName phoneNumber')
      .populate('booking', 'bookingNumber status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: payments.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: { payments }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// Admin: Get payment statistics
export const adminGetPaymentStats = async (req, res) => {
  try {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedPayments: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          completedAmount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
          pendingPayments: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          failedPayments: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          refundedAmount: { $sum: '$refund.amount' }
        }
      }
    ]);

    const methodStats = await Payment.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      }
    ]);

    const result = stats[0] || {
      totalPayments: 0,
      totalAmount: 0,
      completedPayments: 0,
      completedAmount: 0,
      pendingPayments: 0,
      failedPayments: 0,
      refundedAmount: 0
    };

    res.status(200).json({
      status: 'success',
      data: {
        stats: result,
        methodStats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payment statistics',
      error: error.message
    });
  }
};

// Mock MFS verification function (replace with real API calls)
async function mockMFSVerification(method, transactionId, transactionReference, amount) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock verification logic
  if (transactionId && transactionReference && amount > 0) {
    return {
      success: true,
      message: 'Payment verified successfully',
      transactionId,
      transactionReference,
      amount,
      timestamp: new Date()
    };
  } else {
    return {
      success: false,
      message: 'Invalid transaction details',
      code: 'INVALID_TRANSACTION'
    };
  }
}

// Mock refund processing function (replace with real API calls)
async function mockRefundProcessing(method, transactionId, amount) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock refund logic
  if (transactionId && amount > 0) {
    return {
      success: true,
      message: 'Refund processed successfully',
      refundId: `REF${Date.now()}`,
      amount,
      timestamp: new Date()
    };
  } else {
    return {
      success: false,
      message: 'Refund processing failed',
      code: 'REFUND_FAILED'
    };
  }
} 