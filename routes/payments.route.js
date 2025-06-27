import express, { Router } from "express";
import {
  createPayment,
  verifyPayment,
  getPayment,
  getUserPayments,
  cancelPayment,
  processRefund,
  adminGetAllPayments,
  adminGetPaymentStats,
} from "../controllers/payment.controller.js";
import { protect, restrictTo } from "../controllers/auth.controller.js";

const paymentRouter = Router();

// All payment routes require authentication
paymentRouter.use(protect);

// Customer routes
paymentRouter.post("/", restrictTo("customer"), createPayment);
paymentRouter.post("/verify", restrictTo("customer"), verifyPayment);
paymentRouter.get("/my", restrictTo("customer"), getUserPayments);
paymentRouter.get("/:paymentId", restrictTo("customer"), getPayment);
paymentRouter.patch("/:paymentId/cancel", restrictTo("customer"), cancelPayment);

// Admin routes
paymentRouter.get("/admin/all", restrictTo("admin"), adminGetAllPayments);
paymentRouter.get("/admin/stats", restrictTo("admin"), adminGetPaymentStats);
paymentRouter.post("/admin/:paymentId/refund", restrictTo("admin"), processRefund);

export default paymentRouter; 