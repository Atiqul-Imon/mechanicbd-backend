import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { promisify } from "util";
import config from "../config/env.js";

// Helper function to sign JWT token
const signToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

// Helper function to create and send token
const createSendToken = (user, statusCode, res) => {
  // Convert to plain object if needed
  const userObj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete userObj.password;

  const token = signToken(userObj._id);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userObj
    }
  });
};

// Register new user
export const register = async (req, res) => {
  try {
    const { fullName, phoneNumber, email, password, role = "customer" } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User with this phone number already exists",
      });
    }

    // Create new user
    const user = await User.create({
      fullName,
      phoneNumber,
      email,
      password,
      role,
    });

    // Generate OTP for phone verification
    const otp = user.generateOTP();
    
    // In development mode, auto-verify users
    if (config.NODE_ENV === 'development') {
      user.isVerified = true;
      user.clearOTP();
      console.log(`🔧 DEVELOPMENT MODE: Auto-verified user ${phoneNumber}`);
      console.log(`🔧 OTP for ${phoneNumber}: ${otp} (not needed in dev mode)`);
    } else {
      console.log(`📱 OTP for ${phoneNumber}: ${otp}`);
    }
    
    await user.save();

    // TODO: Send OTP via SMS service (only in production)
    if (config.NODE_ENV !== 'development') {
      // Send OTP via SMS service
      console.log(`OTP for ${phoneNumber}: ${otp}`);
    }

    createSendToken(user, 201, res);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      status: "error",
      message: "Error creating user",
      error: error.message,
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;

    // Check if identifier (email or phone) and password exist
    if ((!email && !phoneNumber) || !password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email or phone number and password",
      });
    }

    // Build query based on provided identifier
    let query = {};
    if (email) {
      query.email = email;
    } else if (phoneNumber) {
      query.phoneNumber = phoneNumber;
    }

    // Check if user exists && password is correct
    const user = await User.findOne(query).select("+password");
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect email/phone number or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: "error",
        message: "Account is deactivated. Please contact support.",
      });
    }

    // In development mode, allow unverified users to login
    if (config.NODE_ENV !== 'development' && !user.isVerified) {
      return res.status(401).json({
        status: "error",
        message: "Please verify your phone number first",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Fetch full user object (without password) for response
    const userForResponse = await User.findById(user._id).select("-password");

    createSendToken(userForResponse, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "error",
      message: "Error logging in",
      error: error.message,
    });
  }
};

// Send OTP for phone verification
export const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    // Find user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // TODO: Send OTP via SMS service
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number and OTP are required'
      });
    }

    // Find user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP'
      });
    }

    // Mark user as verified and clear OTP
    user.isVerified = true;
    user.clearOTP();
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get current user profile
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, address, bio, profilePhoto } = req.body;

    // Find user and update
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        fullName,
        email,
        address,
        bio,
        profilePhoto
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update password
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Generate OTP for password reset
    const otp = user.generateOTP();
    await user.save();

    // TODO: Send OTP via SMS
    console.log(`Password reset OTP for ${phoneNumber}: ${otp}`);

    res.status(200).json({
      status: 'success',
      message: 'Password reset OTP sent to your phone'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { phoneNumber, otp, newPassword } = req.body;

    const user = await User.findOne({ phoneNumber }).select('+password');
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP'
      });
    }

    // Update password and clear OTP
    user.password = newPassword;
    user.clearOTP();
    await user.save();

    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Logout
export const logout = async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
};

// JWT Authentication Middleware
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('🔑 Token extracted:', token ? 'YES' : 'NO');
      if (token) {
        console.log('🔑 Token length:', token.length);
        console.log('🔑 Token starts with:', token.substring(0, 20) + '...');
      }
    }

    if (!token) {
      console.log('❌ No token found in headers');
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    console.log('🔐 Verifying token with secret:', config.JWT_SECRET ? 'SECRET_SET' : 'NO_SECRET');
    const decoded = await promisify(jwt.verify)(token, config.JWT_SECRET);
    console.log('✅ Token verified successfully, user ID:', decoded.id);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      console.log('❌ User not found for token');
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // Check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      console.log('❌ Password changed after token issued');
      return res.status(401).json({
        status: 'error',
        message: 'User recently changed password! Please log in again.'
      });
    }

    // Grant access to protected route
    req.user = currentUser;
    console.log('✅ Access granted for user:', currentUser.fullName);
    next();
  } catch (error) {
    console.error('❌ Protect middleware error:', error.message);
    res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again.'
    });
  }
};

// Role-based access control
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log('restrictTo roles:', roles, 'req.user:', req.user);
    if (!roles.includes(req.user.role)) {
      console.log('❌ Permission denied. User role:', req.user.role, 'Allowed roles:', roles);
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action'
      });
    }
    console.log('✅ Permission granted. User role:', req.user.role);
    next();
  };
};

export default {
  register,
  login,
  sendOTP,
  verifyOTP,
  getMe,
  updateProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
  logout,
  protect,
  restrictTo
}; 