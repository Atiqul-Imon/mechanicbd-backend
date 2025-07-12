import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Category and Type
  category: {
    type: String,
    required: [true, 'Service category is required'],
    enum: ['HVAC', 'Electrical', 'Plumbing', 'Appliances', 'Carpentry', 'Painting', 'Cleaning', 'Other'],
    default: 'Other'
  },
  
  subcategory: {
    type: String,
    trim: true,
    maxlength: [50, 'Subcategory cannot exceed 50 characters']
  },
  
  // Pricing
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative']
  },
  
  priceType: {
    type: String,
    enum: ['fixed', 'hourly', 'negotiable'],
    default: 'fixed'
  },
  
  // Service Details
  estimatedDuration: {
    type: Number, // in minutes
    min: [15, 'Minimum duration is 15 minutes']
  },
  
  requirements: [{
    type: String,
    trim: true
  }],
  
  includes: [{
    type: String,
    trim: true
  }],
  
  // Location and Coverage
  serviceArea: {
    type: String,
    required: [true, 'Service area is required'],
    trim: true
  },
  
  coordinates: {
    lat: Number,
    lng: Number
  },
  
  // Mechanic Information
  mechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Mechanic is required']
  },
  
  // Status and Availability
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  availability: {
    monday: { start: String, end: String, available: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, available: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, available: { type: Boolean, default: true } },
    thursday: { start: String, end: String, available: { type: Boolean, default: true } },
    friday: { start: String, end: String, available: { type: Boolean, default: true } },
    saturday: { start: String, end: String, available: { type: Boolean, default: true } },
    sunday: { start: String, end: String, available: { type: Boolean, default: true } }
  },
  
  // Media
  images: [{
    type: String,
    trim: true
  }],
  
  // Ratings and Reviews
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  totalReviews: {
    type: Number,
    default: 0
  },
  
  // Statistics
  totalBookings: {
    type: Number,
    default: 0
  },
  
  completedBookings: {
    type: Number,
    default: 0
  },
  
  // SEO and Search
  tags: [{
    type: String,
    trim: true
  }],
  
  searchKeywords: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
serviceSchema.index({ category: 1 });
serviceSchema.index({ mechanic: 1 });
serviceSchema.index({ isActive: 1, isAvailable: 1 });
serviceSchema.index({ serviceArea: 1 });
serviceSchema.index({ averageRating: -1 });
serviceSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Enhanced indexes for better search performance
serviceSchema.index({ status: 1, isActive: 1, isAvailable: 1 }); // Common filter combination
serviceSchema.index({ category: 1, averageRating: -1 }); // Category + rating sorting
serviceSchema.index({ basePrice: 1 }); // Price sorting
serviceSchema.index({ createdAt: -1 }); // Newest first
serviceSchema.index({ totalBookings: -1 }); // Popularity sorting
serviceSchema.index({ serviceArea: 'text' }); // Location text search
serviceSchema.index({ subcategory: 1 }); // Subcategory filtering
serviceSchema.index({ priceType: 1 }); // Price type filtering
serviceSchema.index({ tags: 1 }); // Tag filtering
serviceSchema.index({ searchKeywords: 'text' }); // Keyword search

// Compound indexes for complex queries
serviceSchema.index({ 
  category: 1, 
  averageRating: -1, 
  isActive: 1, 
  status: 1 
}); // Category + rating + status

serviceSchema.index({ 
  serviceArea: 1, 
  category: 1, 
  isActive: 1 
}); // Location + category

serviceSchema.index({ 
  basePrice: 1, 
  averageRating: -1, 
  isActive: 1 
}); // Price + rating

serviceSchema.index({ 
  mechanic: 1, 
  isActive: 1, 
  status: 1 
}); // Mechanic's services

// Virtual for completion rate
serviceSchema.virtual('completionRate').get(function() {
  if (this.totalBookings === 0) return 0;
  return Math.round((this.completedBookings / this.totalBookings) * 100);
});

// Ensure virtual fields are serialized
serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

const Service = mongoose.model('Service', serviceSchema);

export default Service; 