const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// @route   POST /api/alerts/police
// @desc    Send police alert (user presses "Call Police")
// @access  Public
router.post('/police', alertController.sendPoliceAlert);

// @route   GET /api/alerts
// @desc    Get all alerts (for admin/dashboard)
// @access  Public (should be protected in production)
router.get('/', alertController.getAllAlerts);

// @route   GET /api/alerts/station/:stationId
// @desc    Get alerts by station ID
// @access  Public (should be protected in production)
router.get('/station/:stationId', alertController.getAlertsByStation);

// @route   GET /api/alerts/:id
// @desc    Get single alert details
// @access  Public
router.get('/:id', alertController.getAlertById);

// @route   PUT /api/alerts/:id/acknowledge
// @desc    Acknowledge alert (police officer responds)
// @access  Public (should be protected in production)
router.put('/:id/acknowledge', alertController.acknowledgeAlert);

// @route   PUT /api/alerts/:id/resolve
// @desc    Resolve alert (emergency handled)
// @access  Public (should be protected in production)
router.put('/:id/resolve', alertController.resolveAlert);

// @route   PUT /api/alerts/:id/cancel
// @desc    Cancel alert
// @access  Public
router.put('/:id/cancel', alertController.cancelAlert);

// @route   GET /api/alerts/stats/all
// @desc    Get alert statistics
// @access  Public (should be protected in production)
router.get('/stats/all', alertController.getAlertStats);

module.exports = router;