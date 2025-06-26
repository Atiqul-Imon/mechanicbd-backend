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
} from "../controllers/booking.controller.js";
import { protect, restrictTo } from "../controllers/auth.controller.js";

const bookingRouter = Router();

// All booking routes require authentication
bookingRouter.use(protect);

// Customer and Mechanic routes
bookingRouter.post("/", restrictTo("customer"), createBooking);
bookingRouter.get("/", getAllBookings);
bookingRouter.get("/stats", getBookingStats);
bookingRouter.get("/:id", getBooking);
bookingRouter.patch("/:id/status", updateBookingStatus);
bookingRouter.patch("/:id/cancel", cancelBooking);
bookingRouter.post("/:id/review", restrictTo("customer"), addReview);

// Admin routes
bookingRouter.get("/admin/all", restrictTo("admin"), adminGetAllBookings);
bookingRouter.get("/admin/stats", restrictTo("admin"), adminGetBookingStats);

export default bookingRouter; 