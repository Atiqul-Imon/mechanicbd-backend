import express, { Router } from "express";
import {
  createBooking,
  getAllBookings,
  getBooking,
  updateBookingStatus,
  cancelBooking,
  addReview,
  getBookingStats,
  adminGetAllBookings,
  adminGetBookingStats,
  completeService,
  requestRefund,
  adminHandleRefund,
  requestReschedule,
  respondReschedule,
  deleteBooking,
  getMechanicBookings,
} from "../controllers/booking.controller.js";
import { protect, restrictTo } from "../controllers/auth.controller.js";

const bookingRouter = Router();

// All booking routes require authentication
bookingRouter.use(protect);

// Customer and Mechanic routes
bookingRouter.post("/", restrictTo("customer"), createBooking);
bookingRouter.get("/", getAllBookings);
bookingRouter.get("/stats", getBookingStats);

// --- Place this BEFORE any route with /:id ---
bookingRouter.get("/mechanic", restrictTo("mechanic"), getMechanicBookings);

// Routes with :id (must come after /mechanic)
bookingRouter.get("/:id", getBooking);
bookingRouter.patch("/:id/status", updateBookingStatus);
bookingRouter.patch("/:id/cancel", cancelBooking);
bookingRouter.patch("/:id/complete", completeService);
bookingRouter.post("/:id/review", restrictTo("customer"), addReview);
bookingRouter.delete('/:id', deleteBooking);

// Refund routes
bookingRouter.post('/:id/refund', restrictTo('customer'), requestRefund);
bookingRouter.patch('/:id/refund', restrictTo('admin'), adminHandleRefund);

// Reschedule routes
bookingRouter.post('/:id/reschedule', requestReschedule); // customer or mechanic
bookingRouter.patch('/:id/reschedule', respondReschedule); // other party responds

// Admin routes
bookingRouter.get("/admin/all", restrictTo("admin"), adminGetAllBookings);
bookingRouter.get("/admin/stats", restrictTo("admin"), adminGetBookingStats);

export default bookingRouter; 