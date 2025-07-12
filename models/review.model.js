import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  // Review details
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },

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

  // Rating and feedback
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },

  comment: {
    type: String,
    maxlength: [1000, 'Review comment cannot exceed 1000 characters'],
    trim: true
  },

  // Review status
  isApproved: {
    type: Boolean,
    default: true // Auto-approve in development
  },

  // Review metadata
  helpfulCount: {
    type: Number,
    default: 0
  },

  reportedCount: {
    type: Number,
    default: 0
  },

  isReported: {
    type: Boolean,
    default: false
  },

  // Admin actions
  adminNotes: {
    type: String,
    maxlength: [500, 'Admin notes cannot exceed 500 characters']
  },

  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  moderatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
reviewSchema.index({ service: 1, isApproved: 1 });
reviewSchema.index({ mechanic: 1, isApproved: 1 });
reviewSchema.index({ customer: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Virtual for average rating calculation
reviewSchema.virtual('averageRating').get(function() {
  return this.rating;
});

// Ensure virtuals are included in JSON output
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

const Review = mongoose.model('Review', reviewSchema);

export default Review; 