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
    
    // Fetch services and populate mechanic
    let services = await Service.find(filter)
      .populate('mechanic', 'fullName profilePhoto averageRating totalReviews isAvailable')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    // Filter out services where mechanic is not available
    services = services.filter(s => s.mechanic && s.mechanic.isAvailable !== false);
    const total = services.length;
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
    const { 
      q, 
      category, 
      location, 
      minPrice, 
      maxPrice, 
      minRating,
      maxRating,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      availability,
      priceType,
      subcategory,
      tags,
      mechanicId
    } = req.query;
    
    const filter = { isActive: true, isAvailable: true, status: 'approved' };
    
    // Advanced text search with multiple fields
    if (q && q.trim()) {
      const searchTerms = q.trim().split(' ').filter(term => term.length > 0);
      if (searchTerms.length > 0) {
        const textSearchConditions = searchTerms.map(term => ({
          $or: [
            { title: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
            { tags: { $regex: term, $options: 'i' } },
            { searchKeywords: { $regex: term, $options: 'i' } },
            { subcategory: { $regex: term, $options: 'i' } }
          ]
        }));
        filter.$and = textSearchConditions;
      }
    }
    
    // Category filter
    if (category && category.trim()) {
      filter.category = category.trim();
    }
    
    // Subcategory filter
    if (subcategory && subcategory.trim()) {
      filter.subcategory = { $regex: subcategory.trim(), $options: 'i' };
    }
    
    // Location-based search with fuzzy matching
    if (location && location.trim()) {
      filter.$or = [
        { serviceArea: { $regex: location.trim(), $options: 'i' } },
        { 'mechanic.address': { $regex: location.trim(), $options: 'i' } }
      ];
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice && !isNaN(parseFloat(minPrice))) {
        filter.basePrice.$gte = parseFloat(minPrice);
      }
      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        filter.basePrice.$lte = parseFloat(maxPrice);
      }
    }
    
    // Rating filter
    if (minRating || maxRating) {
      filter.averageRating = {};
      if (minRating && !isNaN(parseFloat(minRating))) {
        filter.averageRating.$gte = parseFloat(minRating);
      }
      if (maxRating && !isNaN(parseFloat(maxRating))) {
        filter.averageRating.$lte = parseFloat(maxRating);
      }
    }
    
    // Price type filter
    if (priceType) {
      filter.priceType = priceType;
    }
    
    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray.map(tag => new RegExp(tag, 'i')) };
    }
    
    // Mechanic filter
    if (mechanicId) {
      filter.mechanic = mechanicId;
    }
    
    // Availability filter
    if (availability) {
      const availabilityMap = {
        'today': { $expr: { $eq: [{ $dayOfWeek: new Date() }, 1] } },
        'weekend': { $or: [{ 'availability.saturday.available': true }, { 'availability.sunday.available': true }] },
        'weekday': { $or: [
          { 'availability.monday.available': true },
          { 'availability.tuesday.available': true },
          { 'availability.wednesday.available': true },
          { 'availability.thursday.available': true },
          { 'availability.friday.available': true }
        ]}
      };
      if (availabilityMap[availability]) {
        Object.assign(filter, availabilityMap[availability]);
      }
    }
    
    // Build sort object
    const sort = {};
    switch (sortBy) {
      case 'relevance':
        if (q && q.trim()) {
          // Use text score for relevance when searching
          sort.score = { $meta: 'textScore' };
        } else {
          sort.averageRating = sortOrder === 'desc' ? -1 : 1;
        }
        break;
      case 'price':
        sort.basePrice = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'rating':
        sort.averageRating = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'newest':
        sort.createdAt = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'popular':
        sort.totalBookings = sortOrder === 'desc' ? -1 : 1;
        break;
      default:
        sort.averageRating = -1;
    }
    
    // Add secondary sort for consistency
    if (sortBy !== 'relevance' || !q) {
      sort.createdAt = -1;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query with pagination
    let services = await Service.find(filter)
      .populate('mechanic', 'fullName profilePhoto averageRating isAvailable totalReviews experience skills bio')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Filter out services where mechanic is not available
    services = services.filter(s => s.mechanic && s.mechanic.isAvailable !== false);
    
    // Get total count for pagination
    const total = await Service.countDocuments(filter);
    
    // Calculate relevance scores for search results
    if (q && q.trim()) {
      services = services.map(service => {
        let score = 0;
        const searchTerms = q.toLowerCase().split(' ');
        
        // Title match (highest weight)
        searchTerms.forEach(term => {
          if (service.title.toLowerCase().includes(term)) score += 10;
        });
        
        // Description match
        searchTerms.forEach(term => {
          if (service.description.toLowerCase().includes(term)) score += 5;
        });
        
        // Tags match
        if (service.tags) {
          searchTerms.forEach(term => {
            if (service.tags.some(tag => tag.toLowerCase().includes(term))) score += 3;
          });
        }
        
        // Rating boost
        if (service.averageRating) {
          score += service.averageRating * 0.5;
        }
        
        // Popularity boost
        if (service.totalBookings) {
          score += Math.min(service.totalBookings * 0.1, 5);
        }
        
        return { ...service, relevanceScore: score };
      });
      
      // Re-sort by relevance score
      services.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      data: {
        services: services || [],
        searchQuery: q || null,
        appliedFilters: {
          category,
          location,
          minPrice,
          maxPrice,
          minRating,
          maxRating,
          sortBy,
          sortOrder
        }
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

// Track search analytics
const trackSearchAnalytics = async (searchQuery, filters, resultsCount) => {
  try {
    // In a production environment, you would store this in a separate analytics collection
    console.log('Search Analytics:', {
      timestamp: new Date(),
      query: searchQuery,
      filters,
      resultsCount,
      userAgent: req?.headers['user-agent'],
      ip: req?.ip
    });
  } catch (error) {
    console.error('Error tracking search analytics:', error);
  }
};

// Get search suggestions and analytics
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(200).json({
        status: 'success',
        data: {
          suggestions: [],
          popularSearches: [],
          trendingCategories: []
        }
      });
    }
    
    const searchTerm = q.trim().toLowerCase();
    
    // Get service title suggestions
    const titleSuggestions = await Service.distinct('title', {
      title: { $regex: searchTerm, $options: 'i' },
      isActive: true,
      status: 'approved'
    });
    
    // Get category suggestions
    const categorySuggestions = await Service.distinct('category', {
      category: { $regex: searchTerm, $options: 'i' },
      isActive: true,
      status: 'approved'
    });
    
    // Get tag suggestions
    const tagSuggestions = await Service.distinct('tags', {
      tags: { $regex: searchTerm, $options: 'i' },
      isActive: true,
      status: 'approved'
    });
    
    // Get subcategory suggestions
    const subcategorySuggestions = await Service.distinct('subcategory', {
      subcategory: { $regex: searchTerm, $options: 'i' },
      isActive: true,
      status: 'approved'
    });
    
    // Combine and rank suggestions
    const allSuggestions = [
      ...titleSuggestions.map(title => ({ text: title, type: 'service', relevance: 10 })),
      ...categorySuggestions.map(cat => ({ text: cat, type: 'category', relevance: 8 })),
      ...tagSuggestions.map(tag => ({ text: tag, type: 'tag', relevance: 6 })),
      ...subcategorySuggestions.map(sub => ({ text: sub, type: 'subcategory', relevance: 7 }))
    ];
    
    // Remove duplicates and sort by relevance
    const uniqueSuggestions = allSuggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text.toLowerCase() === suggestion.text.toLowerCase())
      )
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, parseInt(limit));
    
    // Get popular searches (mock data for now - can be enhanced with analytics)
    const popularSearches = [
      'AC repair', 'electrical wiring', 'plumbing', 'car mechanic', 
      'painting', 'cleaning', 'carpentry', 'appliance repair'
    ];
    
    // Get trending categories
    const trendingCategories = await Service.aggregate([
      { $match: { isActive: true, status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        suggestions: uniqueSuggestions,
        popularSearches,
        trendingCategories: trendingCategories.map(cat => ({
          category: cat._id,
          count: cat.count
        }))
      }
    });
  } catch (error) {
    console.error('Error in getSearchSuggestions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching search suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get search analytics and insights
export const getSearchAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get popular categories
    const popularCategories = await Service.aggregate([
      { $match: { isActive: true, status: 'approved', createdAt: { $gte: startDate } } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgRating: { $avg: '$averageRating' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get price range distribution
    const priceRanges = await Service.aggregate([
      { $match: { isActive: true, status: 'approved' } },
      {
        $bucket: {
          groupBy: '$basePrice',
          boundaries: [0, 500, 1000, 2000, 5000, 10000],
          default: 'Above 10000',
          output: { count: { $sum: 1 } }
        }
      }
    ]);
    
    // Get average ratings by category
    const avgRatingsByCategory = await Service.aggregate([
      { $match: { isActive: true, status: 'approved' } },
      { $group: { _id: '$category', avgRating: { $avg: '$averageRating' }, count: { $sum: 1 } } },
      { $sort: { avgRating: -1 } }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        period,
        popularCategories,
        priceRanges,
        avgRatingsByCategory,
        totalServices: await Service.countDocuments({ isActive: true, status: 'approved' })
      }
    });
  } catch (error) {
    console.error('Error in getSearchAnalytics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching search analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}; 