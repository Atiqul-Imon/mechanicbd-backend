import express, { Router } from "express";
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getUserStats,
  getUserBookings,
  getUserServices,
  adminGetUserStats,
  adminGetUsersByRole,
  adminGetDashboardStats,
} from "../controllers/user.controller.js";
import { protect, restrictTo } from "../controllers/auth.controller.js";

const userRouter = Router();

// All user routes require authentication
userRouter.use(protect);

// Admin routes (must come before parameterized routes)
userRouter.get("/admin/stats", restrictTo("admin"), adminGetUserStats);
userRouter.get("/admin/dashboard-stats", restrictTo("admin"), adminGetDashboardStats);
userRouter.get("/admin/role/:role", restrictTo("admin"), adminGetUsersByRole);

// Get all users (admin only)
userRouter.get("/", restrictTo("admin"), getAllUsers);

// User profile routes (self)
userRouter.get("/me", (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});
userRouter.get("/me/stats", getUserStats);
userRouter.get("/me/bookings", getUserBookings);
userRouter.get("/me/services", getUserServices);
userRouter.patch("/me", updateUser);

// User routes (admin or self)
userRouter.get("/:id", getUser);
userRouter.patch("/:id", updateUser);
userRouter.get("/:id/stats", getUserStats);
userRouter.get("/:id/bookings", getUserBookings);
userRouter.get("/:id/services", getUserServices);

export default userRouter; 