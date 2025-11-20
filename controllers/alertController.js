const Alert = require('../models/Alert');
const PoliceStation = require('../models/PoliceStation');
const User = require('../models/User');
const FireStation = require('../models/FireStation');
const admin = require('../config/firebase');
const HealthCenter = require('../models/HealthCenter');

// Send police alert (main function)
exports.sendPoliceAlert = async (req, res) => {
    try {
        const { userId, type, lat, lng, userPhone, description } = req.body;

        console.log('🔥 Received police alert request:', { userId, type, lat, lng, userPhone });

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'User location (lat/lng) is required'
            });
        }

        // Find nearest police station
        const nearestStation = await PoliceStation.findNearest(
            parseFloat(lat),
            parseFloat(lng),
            1
        );

        if (!nearestStation) {
            return res.status(404).json({
                success: false,
                error: 'No active police stations found'
            });
        }

        console.log('✅ Found nearest police station:', {
            name: nearestStation.stationName,
            distance: nearestStation.distance
        });

        // Create alert record
        const alert = new Alert({
            userId: userId || 'ANONYMOUS',
            userPhone: userPhone || null,
            type: 'police',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            stationId: nearestStation._id,
            stationName: nearestStation.stationName,
            description: description || 'Police assistance required',
            distance: nearestStation.distance,
            priority: 'high'
        });

        await alert.save();
        console.log('✅ Police alert saved to database:', alert._id);

        // Send FCM notification
        let notificationSent = false;
        if (nearestStation.fcmToken) {
            try {
                const message = {
                    token: nearestStation.fcmToken,
                    notification: {
                        title: '🚨 EMERGENCY ALERT - Police Assistance Required',
                        body: `Emergency at ${nearestStation.distance.toFixed(2)} km away. Tap to view details.`
                    },
                    data: {
                        alertId: alert._id.toString(),
                        type: 'police',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        userPhone: userPhone || '',
                        userId: userId || 'ANONYMOUS',
                        timestamp: new Date().toISOString()
                    },
                    webpush: {
                        fcmOptions: {
                            link: '/dashboard'
                        }
                    }
                };

                await admin.messaging().send(message);
                notificationSent = true;
                console.log('✅ FCM notification sent to police station');
            } catch (fcmError) {
                console.error('❌ FCM send error:', fcmError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Police alert sent successfully',
            data: {
                alertId: alert._id,
                stationName: nearestStation.stationName,
                distance: nearestStation.distance,
                notificationSent
            }
        });

    } catch (error) {
        console.error('❌ Police alert error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send police alert'
        });
    }
};

// Send fire alert
exports.sendFireAlert = async (req, res) => {
    try {
        const { userId, type, lat, lng, userPhone, description } = req.body;

        console.log('🔥 Received fire alert request:', { userId, type, lat, lng, userPhone });

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'User location (lat/lng) is required'
            });
        }

        // Find nearest fire station
        const nearestStation = await FireStation.findNearest(
            parseFloat(lat),
            parseFloat(lng),
            1
        );

        if (!nearestStation) {
            return res.status(404).json({
                success: false,
                error: 'No active fire stations found'
            });
        }

        console.log('✅ Found nearest fire station:', {
            name: nearestStation.stationName,
            distance: nearestStation.distance
        });

        // Create alert record
        const alert = new Alert({
            userId: userId || 'ANONYMOUS',
            userPhone: userPhone || null,
            type: 'fire',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            stationId: nearestStation._id,
            stationName: nearestStation.stationName,
            description: description || 'Fire emergency - immediate assistance required',
            distance: nearestStation.distance,
            priority: 'critical'
        });

        await alert.save();
        console.log('✅ Fire alert saved to database:', alert._id);

        // Send FCM notification
        let notificationSent = false;
        if (nearestStation.fcmToken) {
            try {
                const message = {
                    token: nearestStation.fcmToken,
                    notification: {
                        title: '🔥 FIRE EMERGENCY - Immediate Response Required',
                        body: `Fire emergency at ${nearestStation.distance.toFixed(2)} km away. Respond immediately!`
                    },
                    data: {
                        alertId: alert._id.toString(),
                        type: 'fire',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        userPhone: userPhone || '',
                        userId: userId || 'ANONYMOUS',
                        timestamp: new Date().toISOString()
                    },
                    webpush: {
                        fcmOptions: {
                            link: '/dashboard'
                        }
                    }
                };

                await admin.messaging().send(message);
                notificationSent = true;
                console.log('✅ FCM notification sent to fire station');
            } catch (fcmError) {
                console.error('❌ FCM send error:', fcmError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Fire alert sent successfully',
            data: {
                alertId: alert._id,
                stationName: nearestStation.stationName,
                distance: nearestStation.distance,
                notificationSent
            }
        });

    } catch (error) {
        console.error('❌ Fire alert error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send fire alert'
        });
    }
};

// ✅ UPDATED: Get all alerts with optional type filtering
// Get all alerts with optional type filter
exports.getAllAlerts = async (req, res) => {
    try {
        const { type, limit = 100 } = req.query;

        console.log('🔥 Fetching alerts with filters:', { type, limit });

        const query = {};
        if (type) {
            query.type = type;  // Filter by type if provided
        }

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('stationId', 'stationName centerName phone lat lng');

        console.log(`✅ Found ${alerts.length} alerts`);

        res.status(200).json({
            success: true,
            data: alerts
        });
    } catch (error) {
        console.error('❌ Get alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        });
    }
};

// Get alerts for a specific station
exports.getAlertsByStation = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { type } = req.query; // 'police' or 'fire'

        const query = { stationId };
        if (type) {
            query.type = type;
        }

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });

    } catch (error) {
        console.error('❌ Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        });
    }
};

// Get alert by ID
exports.getAlertById = async (req, res) => {
    try {
        const { id } = req.params;

        const alert = await Alert.findById(id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        res.status(200).json({
            success: true,
            data: alert
        });

    } catch (error) {
        console.error('❌ Error fetching alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert'
        });
    }
};

// Update alert status
exports.updateAlertStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'acknowledged', 'en-route', 'resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be: pending, acknowledged, en-route, or resolved'
            });
        }

        const alert = await Alert.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        console.log(`✅ Alert ${id} status updated to: ${status}`);

        res.status(200).json({
            success: true,
            message: 'Alert status updated successfully',
            data: alert
        });

    } catch (error) {
        console.error('❌ Error updating alert status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update alert status'
        });
    }
};


exports.getStationAlerts = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { status, limit = 100 } = req.query;

        const query = { stationId };
        if (status) query.status = status;

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });

    } catch (error) {
        console.error('Get station alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch station alerts',
            details: error.message
        });
    }
};

// Acknowledge alert (police officer responds)
exports.acknowledgeAlert = async (req, res) => {
    try {
        const { id } = req.params;

        const alert = await Alert.findById(id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        if (alert.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Alert is already ${alert.status}`
            });
        }

        alert.status = 'acknowledged';
        alert.responseTime = new Date();
        await alert.save();

        res.status(200).json({
            success: true,
            message: 'Alert acknowledged successfully',
            data: alert
        });

    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to acknowledge alert',
            details: error.message
        });
    }
};

// Resolve alert
exports.resolveAlert = async (req, res) => {
    try {
        const { id } = req.params;

        const alert = await Alert.findById(id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        alert.status = 'resolved';
        alert.resolvedTime = new Date();
        await alert.save();

        res.status(200).json({
            success: true,
            message: 'Alert resolved successfully',
            data: alert
        });

    } catch (error) {
        console.error('Resolve alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve alert',
            details: error.message
        });
    }
};

// Send ambulance alert
exports.sendAmbulanceAlert = async (req, res) => {
    try {
        const { userId, type, lat, lng, userPhone, description } = req.body;

        console.log('🚑 Received ambulance alert request:', { userId, type, lat, lng, userPhone });

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'User location (lat/lng) is required'
            });
        }

        // Find nearest health center
        const nearestCenter = await HealthCenter.findNearest(
            parseFloat(lat),
            parseFloat(lng),
            1
        );

        if (!nearestCenter) {
            return res.status(404).json({
                success: false,
                error: 'No active health centers found'
            });
        }

        console.log('✅ Found nearest health center:', {
            name: nearestCenter.centerName,
            distance: nearestCenter.distance
        });

        // Create alert record
        const alert = new Alert({
            userId: userId || 'ANONYMOUS',
            userPhone: userPhone || null,
            type: 'ambulance',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            stationId: nearestCenter._id,
            stationName: nearestCenter.centerName,
            description: description || 'Medical emergency - ambulance required',
            distance: nearestCenter.distance,
            priority: 'critical'
        });

        await alert.save();
        console.log('✅ Ambulance alert saved to database:', alert._id);

        // Send FCM notification
        let notificationSent = false;
        if (nearestCenter.fcmToken) {
            try {
                const message = {
                    token: nearestCenter.fcmToken,
                    notification: {
                        title: '🚑 MEDICAL EMERGENCY - Ambulance Required',
                        body: `Medical emergency at ${nearestCenter.distance.toFixed(2)} km away. Dispatch ambulance immediately!`
                    },
                    data: {
                        alertId: alert._id.toString(),
                        type: 'ambulance',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        userPhone: userPhone || '',
                        userId: userId || 'ANONYMOUS',
                        timestamp: new Date().toISOString()
                    },
                    webpush: {
                        fcmOptions: {
                            link: '/dashboard'
                        }
                    }
                };

                await admin.messaging().send(message);
                notificationSent = true;
                console.log('✅ FCM notification sent to health center');
            } catch (fcmError) {
                console.error('❌ FCM send error:', fcmError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Ambulance alert sent successfully',
            data: {
                alertId: alert._id,
                centerName: nearestCenter.centerName,
                distance: nearestCenter.distance,
                notificationSent
            }
        });

    } catch (error) {
        console.error('❌ Ambulance alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send ambulance alert'
        });
    }
};