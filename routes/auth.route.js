import express, { Router } from "express";
import {
  register,
  login,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  updatePassword,
  protect,
  restrictTo,
} from "../controllers/auth.controller.js";

const authRouter = Router(); 

// Public routes
authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/send-otp", sendOTP);
authRouter.post("/verify-otp", verifyOTP);
authRouter.post("/forgot-password", forgotPassword);
authRouter.patch("/reset-password", resetPassword);

// Protected routes
authRouter.get("/me", protect, getMe);
authRouter.patch("/update-profile", protect, updateProfile);
authRouter.patch("/update-password", protect, updatePassword);

// Admin only routes
authRouter.get("/admin/users", protect, restrictTo("admin"), (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Admin users route - to be implemented",
  });
});

export default authRouter;