const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Send police alert
router.post('/police', alertController.sendPoliceAlert);

// Send fire alert
router.post('/fire', alertController.sendFireAlert);

router.get('/', alertController.getAllAlerts);

// Get alerts for a specific station
router.get('/station/:stationId', alertController.getAlertsByStation);

// Get alert by ID
router.get('/:id', alertController.getAlertById);

// Update alert status
router.patch('/:id/status', alertController.updateAlertStatus);

module.exports = router;