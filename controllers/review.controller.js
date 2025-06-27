import Review from '../models/review.model.js';
import Booking from '../models/booking.model.js';
import Service from '../models/service.model.js';
import User from '../models/user.model.js';

// Create a review (customer, after booking is completed)
export async function createReview(req, res) {
  try {
    const { service, mechanic, booking, rating, comment } = req.body;
    const customer = req.user.id;

    // Check booking exists and is completed
    const bookingDoc = await Booking.findById(booking);
    if (!bookingDoc || bookingDoc.status !== 'completed') {
      return res.status(400).json({ status: 'error', message: 'You can only review completed bookings.' });
    }
    // Check if already reviewed
    const existing = await Review.findOne({ booking });
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'You have already reviewed this booking.' });
    }
    // Create review
    const review = await Review.create({
      service,
      mechanic: mechanic || bookingDoc.mechanic,
      customer,
      booking,
      rating,
      comment,
    });
    res.status(201).json({ status: 'success', data: { review } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}

// Get reviews for a service
export async function getServiceReviews(req, res) {
  try {
    const { id } = req.params;
    const reviews = await Review.find({ service: id, isApproved: true })
      .populate('customer', 'fullName profilePhoto')
      .sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: reviews.length, data: { reviews } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}

// Get reviews for a mechanic
export async function getMechanicReviews(req, res) {
  try {
    const { id } = req.params;
    const reviews = await Review.find({ mechanic: id, isApproved: true })
      .populate('customer', 'fullName profilePhoto')
      .sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: reviews.length, data: { reviews } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}

// (Optional) Get pending reviews for admin moderation
export async function getPendingReviews(req, res) {
  try {
    const reviews = await Review.find({ isApproved: false })
      .populate('customer', 'fullName profilePhoto')
      .populate('service', 'title')
      .sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: reviews.length, data: { reviews } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}

// (Optional) Approve or reject a review (admin)
export async function approveReview(req, res) {
  try {
    const { id } = req.params;
    const { approve } = req.body;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ status: 'error', message: 'Review not found' });
    review.isApproved = !!approve;
    await review.save();
    res.status(200).json({ status: 'success', data: { review } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
} 