import express, { Router } from "express";
import {
  getAllServices,
  getService,
  createService,
  updateService,
  deleteService,
  searchServices,
  getServicesByMechanic,
  getServiceCategories,
  adminGetAllServices,
  adminToggleServiceStatus,
  adminApproveService,
  adminRejectService,
  getSearchSuggestions,
  getSearchAnalytics,
} from "../controllers/service.controller.js";
import { protect, restrictTo } from "../controllers/auth.controller.js";

const serviceRouter = Router();

// Public routes
serviceRouter.get("/", getAllServices);
serviceRouter.get("/search", searchServices);
serviceRouter.get("/search/suggestions", getSearchSuggestions);
serviceRouter.get("/search/analytics", getSearchAnalytics);
serviceRouter.get("/categories", getServiceCategories);

// Admin routes (must come before parameterized routes)
serviceRouter.get("/admin", adminGetAllServices);
serviceRouter.patch("/admin/:id/toggle", restrictTo("admin"), adminToggleServiceStatus);
serviceRouter.patch("/admin/:id/approve", protect, restrictTo("admin"), adminApproveService);
serviceRouter.patch("/admin/:id/reject", protect, restrictTo("admin"), adminRejectService);

// Mechanic routes
serviceRouter.post("/", protect, restrictTo("mechanic", "admin"), createService);
serviceRouter.get("/mechanic/my", protect, restrictTo("mechanic", "admin"), getServicesByMechanic);

// Parameterized routes (must come after specific routes)
serviceRouter.get("/:id", getService);
serviceRouter.patch("/:id", protect, restrictTo("mechanic", "admin"), updateService);
serviceRouter.delete("/:id", protect, restrictTo("mechanic", "admin"), deleteService);

export default serviceRouter; 