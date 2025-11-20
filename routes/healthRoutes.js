const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Health center registration
router.post('/register', healthController.registerHealthCenter);

// Health center login
router.post('/login', healthController.loginHealthCenter);

// Update FCM token
router.post('/update-token', healthController.updateFCMToken);

// ✅ IMPORTANT: Specific routes BEFORE generic routes!
// Get nearby health centers (MUST be before /:id route)
router.get('/centers/nearby', healthController.getNearbyHealthCenters);

// Get all health centers
router.get('/centers', healthController.getAllHealthCenters);

// Get health center by ID (MUST be after /centers/nearby)
router.get('/centers/:id', healthController.getHealthCenterById);

module.exports = router;