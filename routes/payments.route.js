import express, { Router } from 'express';
import {
  createPayment,
  getPayments,
  getPayment,
  updatePayment,
  deletePayment,
  processPayment,
  getPaymentStats,
  adminGetAllPayments,
  adminProcessRefund
} from '../controllers/payment.controller.js';
import { protect, restrictTo } from '../controllers/auth.controller.js';

const paymentRouter = Router();

// Protected routes
paymentRouter.use(protect);

// Customer and Mechanic routes
paymentRouter.post('/', restrictTo('customer'), createPayment);
paymentRouter.get('/', getPayments);
paymentRouter.get('/stats', getPaymentStats);
paymentRouter.get('/:id', getPayment);
paymentRouter.patch('/:id', updatePayment);
paymentRouter.post('/:id/process', processPayment);

// Admin routes
paymentRouter.get('/admin/all', restrictTo('admin'), adminGetAllPayments);
paymentRouter.post('/admin/:id/refund', restrictTo('admin'), adminProcessRefund);

export default paymentRouter; 