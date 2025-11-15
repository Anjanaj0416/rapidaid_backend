const express = require('express');
const router = express.Router();
const policeController = require('../controllers/policeController');

// @route   POST /api/police/register
// @desc    Register new police station
// @access  Public (should be protected in production)
router.post('/register', policeController.registerStation);

// @route   POST /api/police/login
// @desc    Login police station (phone number only)
// @access  Public
router.post('/login', policeController.loginStation);

// @route   POST /api/police/update-token
// @desc    Update FCM token for police station
// @access  Public (should verify station ID in production)
router.post('/update-token', policeController.updateFCMToken);

// @route   GET /api/police/stations
// @desc    Get all police stations (with optional location filtering)
// @access  Public
router.get('/stations', policeController.getAllStations);

// @route   GET /api/police/stations/:id
// @desc    Get single police station details
// @access  Public
router.get('/stations/:id', policeController.getStationById);

// @route   PUT /api/police/stations/:id
// @desc    Update police station details
// @access  Protected (should add auth middleware in production)
router.put('/stations/:id', policeController.updateStation);

// @route   DELETE /api/police/stations/:id
// @desc    Delete (deactivate) police station
// @access  Protected (should add auth middleware in production)
router.delete('/stations/:id', policeController.deleteStation);

module.exports = router;