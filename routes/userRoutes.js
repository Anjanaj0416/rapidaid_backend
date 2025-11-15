const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// @route   POST /api/user/login
// @desc    User login/register (phone number only)
// @access  Public
router.post('/login', userController.loginUser);

// @route   GET /api/user/profile/:userId
// @desc    Get user profile
// @access  Public (should be protected in production)
router.get('/profile/:userId', userController.getUserProfile);

// @route   PUT /api/user/profile/:userId
// @desc    Update user profile
// @access  Public (should be protected in production)
router.put('/profile/:userId', userController.updateUserProfile);

// @route   POST /api/user/update-token
// @desc    Update FCM token for user
// @access  Public
router.post('/update-token', userController.updateFCMToken);

// @route   POST /api/user/:userId/emergency-contact
// @desc    Add emergency contact
// @access  Public (should be protected in production)
router.post('/:userId/emergency-contact', userController.addEmergencyContact);

// @route   PUT /api/user/:userId/medical-info
// @desc    Update medical information
// @access  Public (should be protected in production)
router.put('/:userId/medical-info', userController.updateMedicalInfo);

// @route   GET /api/user/:userId/alerts
// @desc    Get user alert history
// @access  Public (should be protected in production)
router.get('/:userId/alerts', userController.getUserAlerts);

// @route   DELETE /api/user/:userId
// @desc    Delete (deactivate) user account
// @access  Public (should be protected in production)
router.delete('/:userId', userController.deleteUser);

module.exports = router;