import Payment from '../models/payment.model.js';
import Booking from '../models/booking.model.js';
import User from '../models/user.model.js';

// Create a new payment
export const createPayment = async (req, res) => {
  try {
    const { bookingId, amount, paymentMethod, paymentDetails } = req.body;
    
    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }
    
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only create payments for your own bookings'
      });
    }
    
    // Check if payment already exists for this booking
    const existingPayment = await Payment.findOne({ booking: bookingId });
    if (existingPayment) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment already exists for this booking'
      });
    }
    
    const payment = await Payment.create({
      booking: bookingId,
      customer: req.user.id,
      mechanic: booking.mechanic,
      amount,
      paymentMethod,
      paymentDetails,
      status: 'pending'
    });
    
    await payment.populate([
      { path: 'booking', select: 'bookingNumber serviceLocation' },
      { path: 'customer', select: 'fullName' },
      { path: 'mechanic', select: 'fullName' }
    ]);
    
    res.status(201).json({
      status: 'success',
      data: { payment }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error creating payment',
      error: error.message
    });
  }
};

// Get all payments for user
export const getPayments = async (req, res) => {
  try {
    const { status, paymentMethod, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.user.role === 'customer') {
      filter.customer = req.user.id;
    } else if (req.user.role === 'mechanic') {
      filter.mechanic = req.user.id;
    }
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    const payments = await Payment.find(filter)
      .populate('booking', 'bookingNumber serviceLocation')
      .populate('customer', 'fullName')
      .populate('mechanic', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Payment.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: payments.length,
      pagination: {
        currentPage: parseInt(page),
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

// Get single payment
export const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('booking', 'bookingNumber serviceLocation')
      .populate('customer', 'fullName')
      .populate('mechanic', 'fullName');
    
    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }
    
    // Check access permissions
    if (req.user.role !== 'admin' && 
        payment.customer._id.toString() !== req.user.id && 
        payment.mechanic._id.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this payment'
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

// Update payment
export const updatePayment = async (req, res) => {
  try {
    const { status, paymentDetails } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && 
        payment.customer.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only update your own payments'
      });
    }
    
    if (status) payment.status = status;
    if (paymentDetails) payment.paymentDetails = paymentDetails;
    
    await payment.save();
    
    await payment.populate([
      { path: 'booking', select: 'bookingNumber serviceLocation' },
      { path: 'customer', select: 'fullName' },
      { path: 'mechanic', select: 'fullName' }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: { payment }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating payment',
      error: error.message
    });
  }
};

// Delete payment
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }
    
    // Only admin can delete payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only admins can delete payments'
      });
    }
    
    await Payment.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      status: 'success',
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error deleting payment',
      error: error.message
    });
  }
};

// Process payment
export const processPayment = async (req, res) => {
  try {
    const { transactionId, gateway } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }
    
    // Update payment status
    payment.status = 'completed';
    payment.paymentDetails = {
      ...payment.paymentDetails,
      transactionId,
      gateway,
      paymentDate: new Date()
    };
    
    await payment.save();
    
    // Update booking payment status
    await Booking.findByIdAndUpdate(payment.booking, {
      paymentStatus: 'paid',
      isPaid: true,
      paidAt: new Date()
    });
    
    await payment.populate([
      { path: 'booking', select: 'bookingNumber serviceLocation' },
      { path: 'customer', select: 'fullName' },
      { path: 'mechanic', select: 'fullName' }
    ]);
    
    res.status(200).json({
      status: 'success',
      message: 'Payment processed successfully',
      data: { payment }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error processing payment',
      error: error.message
    });
  }
};

// Get payment statistics
export const getPaymentStats = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'customer') {
      filter.customer = req.user.id;
    } else if (req.user.role === 'mechanic') {
      filter.mechanic = req.user.id;
    }
    
    const stats = await Payment.aggregate([
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
          }
        }
      }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        totalPayments: stats[0]?.totalPayments || 0,
        totalAmount: stats[0]?.totalAmount || 0,
        completedPayments: stats[0]?.completedPayments || 0,
        pendingPayments: stats[0]?.pendingPayments || 0,
        failedPayments: stats[0]?.failedPayments || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching payment stats',
      error: error.message
    });
  }
};

// Admin: Get all payments
export const adminGetAllPayments = async (req, res) => {
  try {
    const { status, paymentMethod, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    const payments = await Payment.find(filter)
      .populate('booking', 'bookingNumber serviceLocation')
      .populate('customer', 'fullName')
      .populate('mechanic', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Payment.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: payments.length,
      pagination: {
        currentPage: parseInt(page),
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

// Admin: Process refund
export const adminProcessRefund = async (req, res) => {
  try {
    const { refundAmount, refundReason } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment not found'
      });
    }
    
    if (payment.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Only completed payments can be refunded'
      });
    }
    
    payment.status = 'refunded';
    payment.refund = {
      isRefunded: true,
      refundAmount: refundAmount || payment.amount,
      refundReason,
      refundStatus: 'processed',
      refundedAt: new Date(),
      refundedBy: req.user.id
    };
    
    await payment.save();
    
    // Update booking refund status
    await Booking.findByIdAndUpdate(payment.booking, {
      'refund.isRefunded': true,
      'refund.refundAmount': refundAmount || payment.amount,
      'refund.refundReason': refundReason,
      'refund.refundStatus': 'processed',
      'refund.refundedAt': new Date(),
      'refund.refundedBy': req.user.id
    });
    
    await payment.populate([
      { path: 'booking', select: 'bookingNumber serviceLocation' },
      { path: 'customer', select: 'fullName' },
      { path: 'mechanic', select: 'fullName' }
    ]);
    
    res.status(200).json({
      status: 'success',
      message: 'Refund processed successfully',
      data: { payment }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error processing refund',
      error: error.message
    });
  }
}; 