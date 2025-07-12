import express, { Router } from 'express';
import {
  createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
  getReviewStats,
  adminGetAllReviews,
  adminDeleteReview
} from '../controllers/review.controller.js';
import { protect, restrictTo } from '../controllers/auth.controller.js';

const reviewRouter = Router();

// Public routes
reviewRouter.get('/', getReviews);
reviewRouter.get('/stats', getReviewStats);

// Protected routes
reviewRouter.use(protect);

// Customer and Mechanic routes
reviewRouter.post('/', restrictTo('customer'), createReview);
reviewRouter.get('/:id', getReview);
reviewRouter.patch('/:id', restrictTo('customer'), updateReview);
reviewRouter.delete('/:id', restrictTo('customer'), deleteReview);

// Admin routes
reviewRouter.get('/admin/all', restrictTo('admin'), adminGetAllReviews);
reviewRouter.delete('/admin/:id', restrictTo('admin'), adminDeleteReview);

export default reviewRouter; 