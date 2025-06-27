import Service from "../models/service.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

// Helper function to create filter object
const createFilter = (query) => {
  const filter = { isActive: true, isAvailable: true };
  
  if (query.category) filter.category = query.category;
  if (query.mechanic) filter.mechanic = query.mechanic;
  if (query.serviceArea) filter.serviceArea = { $regex: query.serviceArea, $options: 'i' };
  if (query.minPrice) filter.basePrice = { $gte: parseFloat(query.minPrice) };
  if (query.maxPrice) {
    filter.basePrice = filter.basePrice || {};
    filter.basePrice.$lte = parseFloat(query.maxPrice);
  }
  if (query.minRating) filter.averageRating = { $gte: parseFloat(query.minRating) };
  
  return filter;
};

// Get all services (with filtering and pagination)
export const getAllServices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = createFilter(req.query);
    filter.status = 'approved'; // Only show approved services
    
    // Build sort object
    const sort = {};
    if (req.query.sortBy) {
      const order = req.query.sortOrder === 'desc' ? -1 : 1;
      sort[req.query.sortBy] = order;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }
    
    const services = await Service.find(filter)
      .populate('mechanic', 'fullName profilePhoto averageRating totalReviews')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(); // Convert to plain objects for better performance
    
    const total = await Service.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: {
        services: services || []
      }
    });
  } catch (error) {
    console.error('Error in getAllServices:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching services',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get single service by ID
export const getService = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid service ID format'
      });
    }
    
    const service = await Service.findById(id)
      .populate('mechanic', 'fullName profilePhoto averageRating totalReviews experience skills bio')
      .lean();
    
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        service
      }
    });
  } catch (error) {
    console.error('Error in getService:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching service',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new service (for mechanics and admins)
export const createService = async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized: user not found or role missing.'
      });
    }
    console.log('createService called. req.user:', req.user);
    // Debug log for request body
    console.log('createService req.body:', req.body);
    // Verify the user is a mechanic or admin
    const mechanic = await User.findById(req.user.id);
    console.log('createService mechanic:', mechanic);
    if (!mechanic || (mechanic.role !== 'mechanic' && mechanic.role !== 'admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'Only mechanics and admins can create services'
      });
    }

    const { title, description, category, basePrice, serviceArea, subcategory, hourlyRate, priceType, estimatedDuration, requirements, includes, coordinates, tags, searchKeywords } = req.body;

    // Create the service
    const service = await Service.create({
      title,
      description,
      category,
      basePrice,
      serviceArea,
      subcategory,
      hourlyRate,
      priceType,
      estimatedDuration,
      requirements,
      includes,
      coordinates,
      tags,
      searchKeywords,
      mechanic: mechanic._id,
      status: 'pending', // Always set to pending on creation
    });

    console.log('✅ Service created successfully:', service);

    res.status(201).json({
      status: 'success',
      data: {
        service
      }
    });
  } catch (error) {
    console.log('❌ Error creating service:', error.message);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update service (owner only)
export const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found'
      });
    }
    
    // Check if user owns the service or is admin
    if (service.mechanic.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You can only update your own services'
      });
    }
    
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('mechanic', 'fullName profilePhoto');
    
    res.status(200).json({
      status: 'success',
      data: {
        service: updatedService
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating service',
      error: error.message
    });
  }
};

// Delete service (owner or admin)
export const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found'
      });
    }
    
    // Check if user owns the service or is admin
    if (service.mechanic.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You can only delete your own services'
      });
    }
    
    await Service.findByIdAndDelete(req.params.id);
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error deleting service',
      error: error.message
    });
  }
};

// Search services
export const searchServices = async (req, res) => {
  try {
    const { q, category, location, minPrice, maxPrice } = req.query;
    
    const filter = { isActive: true, isAvailable: true };
    
    // Text search
    if (q && q.trim()) {
      filter.$text = { $search: q.trim() };
    }
    
    // Category filter
    if (category && category.trim()) {
      filter.category = category.trim();
    }
    
    // Location filter
    if (location && location.trim()) {
      filter.serviceArea = { $regex: location.trim(), $options: 'i' };
    }
    
    // Price filter
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice && !isNaN(parseFloat(minPrice))) {
        filter.basePrice.$gte = parseFloat(minPrice);
      }
      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        filter.basePrice.$lte = parseFloat(maxPrice);
      }
    }
    
    const services = await Service.find(filter)
      .populate('mechanic', 'fullName profilePhoto averageRating')
      .sort(q ? { score: { $meta: 'textScore' } } : { averageRating: -1 })
      .limit(20)
      .lean();
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      data: {
        services: services || []
      }
    });
  } catch (error) {
    console.error('Error in searchServices:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error searching services',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get services by mechanic
export const getServicesByMechanic = async (req, res) => {
  try {
    const mechanicId = req.params.mechanicId || req.user?.id;
    
    if (!mechanicId) {
      return res.status(400).json({
        status: 'error',
        message: 'Mechanic ID is required'
      });
    }
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(mechanicId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid mechanic ID format'
      });
    }
    
    const services = await Service.find({ 
      mechanic: mechanicId, 
      isActive: true 
    })
    .populate('mechanic', 'fullName profilePhoto')
    .lean();
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      data: {
        services: services || []
      }
    });
  } catch (error) {
    console.error('Error in getServicesByMechanic:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching mechanic services',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get service categories
export const getServiceCategories = async (req, res) => {
  try {
    const categories = await Service.distinct('category');
    
    res.status(200).json({
      status: 'success',
      data: {
        categories: categories || []
      }
    });
  } catch (error) {
    console.error('Error in getServiceCategories:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin: Get all services (including inactive)
export const adminGetAllServices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    const services = await Service.find(filter)
      .populate('mechanic', 'fullName phoneNumber email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Service.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: {
        services
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching services',
      error: error.message
    });
  }
};

// Admin: Toggle service status
export const adminToggleServiceStatus = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found'
      });
    }
    
    service.isActive = !service.isActive;
    await service.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        service
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error toggling service status',
      error: error.message
    });
  }
};

// Admin: Approve a service
export const adminApproveService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ status: 'error', message: 'Service not found' });
    }
    service.status = 'approved';
    await service.save();
    res.status(200).json({ status: 'success', data: { service } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error approving service', error: error.message });
  }
};

// Admin: Reject a service
export const adminRejectService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ status: 'error', message: 'Service not found' });
    }
    service.status = 'rejected';
    await service.save();
    res.status(200).json({ status: 'success', data: { service } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error rejecting service', error: error.message });
  }
}; 