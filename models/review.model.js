import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  mechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true, // Only one review per booking
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isApproved: {
    type: Boolean,
    default: true, // Set to false if you want admin moderation
  },
});

// Static method to calculate average rating for a service
reviewSchema.statics.calcAverageRating = async function(serviceId) {
  const stats = await this.aggregate([
    { $match: { service: serviceId, isApproved: true } },
    { $group: {
      _id: '$service',
      avgRating: { $avg: '$rating' },
      nRating: { $sum: 1 },
    }},
  ]);
  if (stats.length > 0) {
    await mongoose.model('Service').findByIdAndUpdate(serviceId, {
      averageRating: stats[0].avgRating,
      totalReviews: stats[0].nRating,
    });
  } else {
    await mongoose.model('Service').findByIdAndUpdate(serviceId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
};

// Post-save and post-remove hooks to update average rating
reviewSchema.post('save', function() {
  this.constructor.calcAverageRating(this.service);
});
reviewSchema.post('remove', function() {
  this.constructor.calcAverageRating(this.service);
});

const Review = mongoose.model('Review', reviewSchema);
export default Review; 