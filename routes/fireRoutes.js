const express = require('express');
const router = express.Router();
const fireController = require('../controllers/fireController');

// Fire Station Registration
router.post('/register', fireController.registerFireStation);

// Fire Station Login
router.post('/login', fireController.loginFireStation);

// Update FCM Token
router.post('/update-token', fireController.updateFCMToken);

// Get All Fire Stations (for Flutter map)
router.get('/stations', fireController.getAllFireStations);

// Get Fire Station by ID
router.get('/:id', fireController.getFireStationById);

module.exports = router;