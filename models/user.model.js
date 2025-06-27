import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Basic Information
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  
  // Authentication
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^(\+880|880|0)?1[3-9]\d{8}$/, 'Please enter a valid Bangladeshi phone number']
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Role and Status
  role: {
    type: String,
    enum: ['customer', 'mechanic', 'admin'],
    default: 'customer'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Profile Information
  profilePhoto: {
    type: String,
    default: null
  },
  
  address: {
    street: String,
    city: String,
    district: String,
    postalCode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  
  // Mechanic Specific Fields
  skills: [{
    type: String,
    enum: ['HVAC', 'Electrical', 'Plumbing', 'Appliances', 'Carpentry', 'Painting', 'Cleaning', 'Other']
  }],
  
  experience: {
    type: Number, // Years of experience
    min: 0,
    max: 50
  },
  
  hourlyRate: {
    type: Number,
    min: 0
  },
  
  // Verification
  nidNumber: {
    type: String,
    trim: true
  },
  
  nidPhoto: {
    type: String
  },
  
  // OTP for phone verification
  otp: {
    code: String,
    expiresAt: Date
  },
  
  // Timestamps
  lastLogin: {
    type: Date
  },
  
  passwordChangedAt: Date,
  
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Update passwordChangedAt when password is modified
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure token is created after password change
  next();
});

// Instance method to check if password is correct
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Generate OTP
userSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  };
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function(otpCode) {
  if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
    return false;
  }
  
  if (this.otp.expiresAt < new Date()) {
    return false; // OTP expired
  }
  
  return this.otp.code === otpCode;
};

// Clear OTP after verification
userSchema.methods.clearOTP = function() {
  this.otp = undefined;
};

const User = mongoose.model('User', userSchema);
export default User; 