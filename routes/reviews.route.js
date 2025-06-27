import express from 'express';
import { 
  createReview, 
  getServiceReviews, 
  getMechanicReviews, 
  getPendingReviews, 
  approveReview 
} from '../controllers/review.controller.js';
import { protect, restrictTo } from '../controllers/auth.controller.js';

const router = express.Router();

// Create a review (customer, must be logged in)
router.post('/', protect, createReview);

// Get reviews for a service
router.get('/service/:id', getServiceReviews);

// Get reviews for a mechanic
router.get('/mechanic/:id', getMechanicReviews);

// Admin: Get pending reviews
router.get('/pending', protect, restrictTo('admin'), getPendingReviews);

// Admin: Approve/reject review
router.patch('/:id/approve', protect, restrictTo('admin'), approveReview);

export default router; 