import Review from '../models/review.model.js';
import User from '../models/user.model.js';
import Service from '../models/service.model.js';

// Create a new review
export const createReview = async (req, res) => {
  try {
    const { serviceId, mechanicId, rating, comment } = req.body;
    
    // Check if user has already reviewed this service/mechanic
    const existingReview = await Review.findOne({
      customer: req.user.id,
      service: serviceId,
      mechanic: mechanicId
    });
    
    if (existingReview) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already reviewed this service'
      });
    }
    
    const review = await Review.create({
      customer: req.user.id,
      service: serviceId,
      mechanic: mechanicId,
      rating,
      comment
    });
    
    await review.populate([
      { path: 'customer', select: 'fullName' },
      { path: 'service', select: 'title' },
      { path: 'mechanic', select: 'fullName' }
    ]);
    
    res.status(201).json({
      status: 'success',
      data: { review }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error creating review',
      error: error.message
    });
  }
};

// Get all reviews with filtering
export const getReviews = async (req, res) => {
  try {
    const { serviceId, mechanicId, rating, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (serviceId) filter.service = serviceId;
    if (mechanicId) filter.mechanic = mechanicId;
    if (rating) filter.rating = rating;
    
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find(filter)
      .populate('customer', 'fullName')
      .populate('service', 'title')
      .populate('mechanic', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Review.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: reviews.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: { reviews }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// Get single review
export const getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('customer', 'fullName')
      .populate('service', 'title')
      .populate('mechanic', 'fullName');
    
    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { review }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching review',
      error: error.message
    });
  }
};

// Update review
export const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found'
      });
    }
    
    // Check if user owns this review
    if (review.customer.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only update your own reviews'
      });
    }
    
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();
    
    await review.populate([
      { path: 'customer', select: 'fullName' },
      { path: 'service', select: 'title' },
      { path: 'mechanic', select: 'fullName' }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: { review }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating review',
      error: error.message
    });
  }
};

// Delete review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found'
      });
    }
    
    // Check if user owns this review or is admin
    if (review.customer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You can only delete your own reviews'
      });
    }
    
    await Review.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      status: 'success',
      message: 'Review deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error deleting review',
      error: error.message
    });
  }
};

// Get review statistics
export const getReviewStats = async (req, res) => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);
    
    const ratingCounts = {};
    if (stats[0] && stats[0].ratingDistribution) {
      stats[0].ratingDistribution.forEach(rating => {
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        totalReviews: stats[0]?.totalReviews || 0,
        averageRating: stats[0]?.averageRating || 0,
        ratingDistribution: ratingCounts
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching review stats',
      error: error.message
    });
  }
};

// Admin: Get all reviews
export const adminGetAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find()
      .populate('customer', 'fullName')
      .populate('service', 'title')
      .populate('mechanic', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Review.countDocuments();
    
    res.status(200).json({
      status: 'success',
      results: reviews.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: { reviews }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// Admin: Delete any review
export const adminDeleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found'
      });
    }
    
    await Review.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      status: 'success',
      message: 'Review deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error deleting review',
      error: error.message
    });
  }
}; 