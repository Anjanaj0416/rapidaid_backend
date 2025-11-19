const express = require('express');
const router = express.Router();
const fireController = require('../controllers/fireController');

router.post('/register', fireController.registerFireStation);
router.post('/login', fireController.loginFireStation);
router.post('/update-token', fireController.updateFCMToken);

// ✅ CRITICAL: Specific routes BEFORE generic routes
router.get('/stations/nearby', fireController.getNearbyFireStations);  // Must be first!
router.get('/stations', fireController.getAllFireStations);
router.get('/stations/:id', fireController.getFireStationById);        // Must be last!

module.exports = router;