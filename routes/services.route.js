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
} from "../controllers/service.controller.js";
import { protect, restrictTo } from "../controllers/auth.controller.js";

const serviceRouter = Router();

// Public routes
serviceRouter.get("/", getAllServices);
serviceRouter.get("/search", searchServices);
serviceRouter.get("/categories", getServiceCategories);

// Admin routes (must come before parameterized routes)
serviceRouter.get("/admin", adminGetAllServices);
serviceRouter.patch("/admin/:id/toggle", restrictTo("admin"), adminToggleServiceStatus);

// Mechanic routes
serviceRouter.post("/", restrictTo("mechanic", "admin"), createService);
serviceRouter.get("/mechanic/my", restrictTo("mechanic", "admin"), getServicesByMechanic);

// Parameterized routes (must come after specific routes)
serviceRouter.get("/:id", getService);
serviceRouter.patch("/:id", restrictTo("mechanic", "admin"), updateService);
serviceRouter.delete("/:id", restrictTo("mechanic", "admin"), deleteService);

export default serviceRouter; 