import User from "../models/user.model.js";
import Booking from "../models/booking.model.js";
import Service from "../models/service.model.js";

// Helper function to create filter object
const createUserFilter = (query) => {
  const filter = {};
  
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.isVerified !== undefined) filter.isVerified = query.isVerified === 'true';
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { phoneNumber: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } }
    ];
  }
  
  return filter;
};

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = createUserFilter(req.query);
    
    // Build sort object
    const sort = {};
    if (req.query.sortBy) {
      const order = req.query.sortOrder === 'desc' ? -1 : 1;
      sort[req.query.sortBy] = order;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }
    
    const users = await User.find(filter)
      .select('-password -otp -passwordResetToken -passwordResetExpires')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: {
        users
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get single user by ID (admin or self)
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -otp -passwordResetToken -passwordResetExpires');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Check if user has access to this profile
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this user profile'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Update user profile (admin or self)
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Check if user can update this profile
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only update your own profile'
      });
    }
    
    // Prevent role change unless admin
    if (req.body.role && req.user.role !== 'admin') {
      delete req.body.role;
    }
    
    // Prevent email/phone change for non-admin users
    if (!req.user.role === 'admin') {
      delete req.body.email;
      delete req.body.phoneNumber;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password -otp -passwordResetToken -passwordResetExpires');
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Prevent admin from deleting themselves
    if (user.role === 'admin' && req.user.id === req.params.id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot delete your own admin account'
      });
    }
    
    // Check for active bookings
    const activeBookings = await Booking.find({
      $or: [
        { customer: req.params.id, status: { $in: ['pending', 'confirmed', 'in_progress'] } },
        { mechanic: req.params.id, status: { $in: ['pending', 'confirmed', 'in_progress'] } }
      ]
    });
    
    if (activeBookings.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete user with active bookings'
      });
    }
    
    // Soft delete - set isActive to false
    user.isActive = false;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'User deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Toggle user status (admin only)
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Prevent admin from deactivating themselves
    if (user.role === 'admin' && req.user.id === req.params.id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot deactivate your own admin account'
      });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error toggling user status',
      error: error.message
    });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    
    // Check if user has access
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this user statistics'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    let stats = {};
    
    if (user.role === 'customer') {
      // Customer statistics
      const customerStats = await Booking.aggregate([
        { $match: { customer: user._id } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
            avgRating: { $avg: '$customerRating' }
          }
        }
      ]);
      
      stats = customerStats[0] || {
        totalBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
        avgRating: 0
      };
      
    } else if (user.role === 'mechanic') {
      // Mechanic statistics
      const mechanicStats = await Booking.aggregate([
        { $match: { mechanic: user._id } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            totalEarnings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
            avgRating: { $avg: '$customerRating' }
          }
        }
      ]);
      
      const serviceStats = await Service.aggregate([
        { $match: { mechanic: user._id } },
        {
          $group: {
            _id: null,
            totalServices: { $sum: 1 },
            activeServices: { $sum: { $cond: ['$isActive', 1, 0] } }
          }
        }
      ]);
      
      stats = {
        ...mechanicStats[0] || {
          totalBookings: 0,
          completedBookings: 0,
          totalEarnings: 0,
          avgRating: 0
        },
        ...serviceStats[0] || {
          totalServices: 0,
          activeServices: 0
        }
      };
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

// Get user bookings
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Check if user has access
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this user bookings'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    let filter = {};
    if (user.role === 'customer') {
      filter.customer = user._id;
    } else if (user.role === 'mechanic') {
      filter.mechanic = user._id;
    }
    
    if (req.query.status) filter.status = req.query.status;
    
    const bookings = await Booking.find(filter)
      .populate('service', 'title category basePrice')
      .populate('mechanic', 'fullName phoneNumber profilePhoto')
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
      message: 'Error fetching user bookings',
      error: error.message
    });
  }
};

// Get user services (for mechanics)
export const getUserServices = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Check if user has access
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have access to this user services'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    if (user.role !== 'mechanic') {
      return res.status(400).json({
        status: 'error',
        message: 'Only mechanics have services'
      });
    }
    
    const filter = { mechanic: user._id };
    if (req.query.status) {
      if (req.query.status === 'active') filter.isActive = true;
      if (req.query.status === 'inactive') filter.isActive = false;
    }
    
    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Service.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: {
        services
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user services',
      error: error.message
    });
  }
};

// Admin: Get overall user statistics
export const adminGetUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          customers: { $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] } },
          mechanics: { $sum: { $cond: [{ $eq: ['$role', 'mechanic'] }, 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalUsers: 0,
      customers: 0,
      mechanics: 0,
      admins: 0,
      activeUsers: 0,
      verifiedUsers: 0
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
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

// Admin: Get users by role
export const adminGetUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = { role };
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    const users = await User.find(filter)
      .select('-password -otp -passwordResetToken -passwordResetExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: {
        users
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching users by role',
      error: error.message
    });
  }
};

// Admin: Get comprehensive dashboard statistics
export const adminGetDashboardStats = async (req, res) => {
  try {
    // Get user statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalCustomers: { $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] } },
          totalMechanics: { $sum: { $cond: [{ $eq: ['$role', 'mechanic'] }, 1, 0] } },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          pendingMechanics: { $sum: { $cond: [{ $and: [{ $eq: ['$role', 'mechanic'] }, { $eq: ['$isVerified', false] }] }, 1, 0] } }
        }
      }
    ]);

    // Get booking statistics
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          activeBookings: { $sum: { $cond: [{ $in: ['$status', ['pending', 'confirmed', 'in_progress']] }, 1, 0] } },
          completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelledBookings: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$totalAmount' },
          todayBookings: { $sum: 1 }
        }
      }
    ]);

    const userResult = userStats[0] || {
      totalUsers: 0,
      totalCustomers: 0,
      totalMechanics: 0,
      activeUsers: 0,
      pendingMechanics: 0
    };

    const bookingResult = bookingStats[0] || {
      totalBookings: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0
    };

    const todayResult = todayStats[0] || {
      todayRevenue: 0,
      todayBookings: 0
    };

    const combinedStats = {
      ...userResult,
      ...bookingResult,
      ...todayResult
    };

    res.status(200).json({
      status: 'success',
      data: {
        stats: combinedStats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

// Mechanic: Update availability (pause/resume all services)
export const updateAvailability = async (req, res) => {
  try {
    if (req.user.role !== 'mechanic') {
      return res.status(403).json({
        status: 'error',
        message: 'Only mechanics can update availability.'
      });
    }
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'isAvailable must be a boolean.'
      });
    }
    req.user.isAvailable = isAvailable;
    await req.user.save();
    res.status(200).json({
      status: 'success',
      message: `Availability updated to ${isAvailable ? 'available' : 'unavailable'}`,
      data: { isAvailable: req.user.isAvailable }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating availability',
      error: error.message
    });
  }
}; 