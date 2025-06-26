import Booking from "../models/booking.model.js";
import Service from "../models/service.model.js";
import User from "../models/user.model.js";

// Helper function to create filter object
const createBookingFilter = (query, userRole, userId) => {
  const filter = {};
  
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.date) {
    const date = new Date(query.date);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    filter.scheduledDate = { $gte: date, $lt: nextDate };
  }
  
  // Role-based filtering
  if (userRole === 'customer') {
    filter.customer = userId;
  } else if (userRole === 'mechanic') {
    filter.mechanic = userId;
  }
  
  return filter;
};

// Create new booking
export const createBooking = async (req, res) => {
  try {
    const { serviceId, scheduledDate, scheduledTime, serviceLocation, customerNotes, serviceRequirements } = req.body;
    
    // Verify the service exists and is available
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found'
      });
    }
    
    if (!service.isActive || !service.isAvailable) {
      return res.status(400).json({
        status: 'error',
        message: 'Service is not available'
      });
    }
    
    // Check if mechanic is available at the scheduled time
    const scheduledDateTime = new Date(scheduledDate);
    scheduledDateTime.setHours(parseInt(scheduledTime.split(':')[0]));
    scheduledDateTime.setMinutes(parseInt(scheduledTime.split(':')[1]));
    
    // Check for conflicting bookings (simplified check)
    const conflictingBooking = await Booking.findOne({
      mechanic: service.mechanic,
      scheduledDate: scheduledDate,
      status: { $in: ['pending', 'confirmed', 'in_progress'] }
    });
    
    if (conflictingBooking) {
      return res.status(400).json({
        status: 'error',
        message: 'Mechanic is not available at the scheduled time'
      });
    }
    
    // Calculate total amount
    const totalAmount = service.basePrice;
    
    const bookingData = {
      service: serviceId,
      mechanic: service.mechanic,
      customer: req.user.id,
      scheduledDate,
      scheduledTime,
      estimatedDuration: service.estimatedDuration,
      serviceLocation,
      customerNotes,
      serviceRequirements,
      basePrice: service.basePrice,
      totalAmount
    };
    
    const booking = await Booking.create(bookingData);
    
    // Populate related data
    await booking.populate([
      { path: 'service', select: 'title category basePrice' },
      { path: 'mechanic', select: 'fullName phoneNumber' },
      { path: 'customer', select: 'fullName phoneNumber' }
    ]);
    
    res.status(201).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error creating booking',
      error: error.message
    });
  }
};

// Get all bookings (with filtering and pagination)
export const getAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = createBookingFilter(req.query, req.user.role, req.user.id);
    
    // Build sort object
    const sort = {};
    if (req.query.sortBy) {
      const order = req.query.sortOrder === 'desc' ? -1 : 1;
      sort[req.query.sortBy] = order;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }
    
    const bookings = await Booking.find(filter)
      .populate('service', 'title category basePrice')
      .populate('mechanic', 'fullName phoneNumber profilePhoto')
      .populate('customer', 'fullName phoneNumber')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await Booking.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: bookings.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: {
        bookings
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// Get single booking by ID
export const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service', 'title category basePrice description')
      .populate('mechanic', 'fullName phoneNumber profilePhoto averageRating')
      .populate('customer', 'fullName phoneNumber')
      .populate('statusHistory.updatedBy', 'fullName');
    
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }
    
    // Check if user has access to this booking
    if (req.user.role !== 'admin' && 
        booking.customer._id.toString() !== req.user.id && 
        booking.mechanic._id.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this booking'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching booking',
      error: error.message
    });
  }
};

// Update booking status
export const updateBookingStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }
    
    // Check if user can update this booking
    if (req.user.role !== 'admin' && 
        booking.customer.toString() !== req.user.id && 
        booking.mechanic.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You cannot update this booking'
      });
    }
    
    // Validate status transition
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      disputed: ['resolved']
    };
    
    if (!validTransitions[booking.status].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status transition from ${booking.status} to ${status}`
      });
    }
    
    // Update status
    booking.status = status;
    
    // Add note to status history
    if (note) {
      booking.statusHistory[booking.statusHistory.length - 1].note = note;
    }
    
    // Handle specific status actions
    if (status === 'in_progress') {
      booking.actualStartTime = new Date();
    } else if (status === 'completed') {
      booking.actualEndTime = new Date();
      if (booking.actualStartTime) {
        booking.actualDuration = Math.round((booking.actualEndTime - booking.actualStartTime) / (1000 * 60));
      }
    } else if (status === 'cancelled') {
      booking.cancelledBy = req.user.id;
      booking.cancelledAt = new Date();
    }
    
    await booking.save();
    
    // Populate related data
    await booking.populate([
      { path: 'service', select: 'title category' },
      { path: 'mechanic', select: 'fullName phoneNumber' },
      { path: 'customer', select: 'fullName phoneNumber' }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating booking status',
      error: error.message
    });
  }
};

// Cancel booking
export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }
    
    // Check if booking can be cancelled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking cannot be cancelled'
      });
    }
    
    // Check if user can cancel this booking
    if (req.user.role !== 'admin' && 
        booking.customer.toString() !== req.user.id && 
        booking.mechanic.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You cannot cancel this booking'
      });
    }
    
    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.cancelledBy = req.user.id;
    booking.cancelledAt = new Date();
    
    await booking.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// Add review to booking
export const addReview = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }
    
    // Check if user is the customer
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Only the customer can add reviews'
      });
    }
    
    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Can only review completed bookings'
      });
    }
    
    // Check if already reviewed
    if (booking.customerRating) {
      return res.status(400).json({
        status: 'error',
        message: 'Booking already reviewed'
      });
    }
    
    booking.customerRating = rating;
    booking.customerReview = review;
    booking.reviewDate = new Date();
    
    await booking.save();
    
    // Update mechanic's average rating
    const mechanicBookings = await Booking.find({
      mechanic: booking.mechanic,
      customerRating: { $exists: true }
    });
    
    const totalRating = mechanicBookings.reduce((sum, b) => sum + b.customerRating, 0);
    const averageRating = totalRating / mechanicBookings.length;
    
    await User.findByIdAndUpdate(booking.mechanic, {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: mechanicBookings.length
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error adding review',
      error: error.message
    });
  }
};

// Get booking statistics
export const getBookingStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let matchCondition = {};
    if (userRole === 'customer') {
      matchCondition.customer = userId;
    } else if (userRole === 'mechanic') {
      matchCondition.mechanic = userId;
    }
    
    const stats = await Booking.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalEarnings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } }
        }
      }
    ]);
    
    const result = stats[0] || {
      total: 0,
      pending: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      totalEarnings: 0
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        stats: result
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching booking statistics',
      error: error.message
    });
  }
};

// Admin: Get all bookings (including inactive)
export const adminGetAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.mechanic) filter.mechanic = req.query.mechanic;
    if (req.query.customer) filter.customer = req.query.customer;
    
    const bookings = await Booking.find(filter)
      .populate('service', 'title category')
      .populate('mechanic', 'fullName phoneNumber')
      .populate('customer', 'fullName phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Booking.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: bookings.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: {
        bookings
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// Admin: Get booking statistics
export const adminGetBookingStats = async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
          avgRating: { $avg: '$customerRating' }
        }
      }
    ]);
    
    const result = stats[0] || {
      total: 0,
      pending: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0,
      avgRating: 0
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        stats: result
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching booking statistics',
      error: error.message
    });
  }
}; 