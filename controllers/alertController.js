const Alert = require('../models/Alert');
const PoliceStation = require('../models/PoliceStation');
const User = require('../models/User');
const admin = require('../config/firebase');

// Send police alert (main function)
exports.sendPoliceAlert = async (req, res) => {
    try {
        const { userId, type, lat, lng, userPhone } = req.body;

        // Validation
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

        // Create alert record
        const alert = new Alert({
            userId: userId || 'ANONYMOUS',
            userPhone,  // ✅ Add this
            type: type || 'police',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            stationId: nearestStation._id,
            stationName: nearestStation.stationName,
            userPhone,
            description,
            distance: nearestStation.distance,
            priority: 'high'
        });

        await alert.save();

        // Send FCM notification to nearest station
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
                        type: 'police',
                        alertId: alert._id.toString(),
                        lat: lat.toString(),
                        lng: lng.toString(),
                        distance: nearestStation.distance.toString(),
                        stationId: nearestStation._id.toString(),
                        stationName: nearestStation.stationName,
                        userPhone: userPhone || '',
                        timestamp: new Date().toISOString(),
                        priority: 'high'
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            priority: 'high',
                            channelId: 'emergency_alerts'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                contentAvailable: true,
                                badge: 1
                            }
                        }
                    },
                    webpush: {
                        notification: {
                            icon: '/icon.png',
                            badge: '/badge.png',
                            requireInteraction: true,
                            vibrate: [200, 100, 200, 100, 200]
                        }
                    }
                };

                const response = await admin.messaging().send(message);
                console.log('✅ FCM notification sent:', response);
                notificationSent = true;
                
                // Update alert status
                alert.notificationSent = true;
                await alert.save();

            } catch (fcmError) {
                console.error('❌ FCM notification error:', fcmError);
                // Don't fail the request, just log the error
            }
        } else {
            console.warn('⚠️ No FCM token available for station:', nearestStation.stationName);
        }

        res.status(201).json({
            success: true,
            message: 'Alert sent successfully',
            data: {
                alertId: alert._id,
                station: {
                    id: nearestStation._id,
                    name: nearestStation.stationName,
                    phone: nearestStation.phone,
                    distance: nearestStation.distance,
                    lat: nearestStation.lat,
                    lng: nearestStation.lng
                },
                notificationSent,
                timestamp: alert.createdAt
            }
        });

    } catch (error) {
        console.error('Send alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send alert',
            details: error.message
        });
    }
};

// Get all alerts (for admin/dashboard)
exports.getAllAlerts = async (req, res) => {
    try {
        const { 
            status, 
            type, 
            stationId, 
            limit = 50, 
            page = 1 
        } = req.query;

        const query = {};
        if (status) query.status = status;
        if (type) query.type = type;
        if (stationId) query.stationId = stationId;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('stationId', 'stationName phone lat lng');

        const total = await Alert.countDocuments(query);

        res.status(200).json({
            success: true,
            count: alerts.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: alerts
        });

    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts',
            details: error.message
        });
    }
};

// Get alerts by station ID
exports.getAlertsByStation = async (req, res) => {
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

// Get single alert details
exports.getAlertById = async (req, res) => {
    try {
        const { id } = req.params;

        const alert = await Alert.findById(id)
            .populate('stationId', 'stationName phone lat lng address');

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
        console.error('Get alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert',
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

        // Optional: Send notification back to user that help is on the way
        // This would require user FCM token

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

// Resolve alert (emergency handled)
exports.resolveAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const alert = await Alert.findById(id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        alert.status = 'resolved';
        alert.resolvedTime = new Date();
        if (notes) alert.description = notes;
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

// Cancel alert
exports.cancelAlert = async (req, res) => {
    try {
        const { id } = req.params;

        const alert = await Alert.findById(id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        alert.status = 'cancelled';
        await alert.save();

        res.status(200).json({
            success: true,
            message: 'Alert cancelled successfully',
            data: alert
        });

    } catch (error) {
        console.error('Cancel alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel alert',
            details: error.message
        });
    }
};

// Get alert statistics
exports.getAlertStats = async (req, res) => {
    try {
        const totalAlerts = await Alert.countDocuments();
        const pendingAlerts = await Alert.countDocuments({ status: 'pending' });
        const acknowledgedAlerts = await Alert.countDocuments({ status: 'acknowledged' });
        const resolvedAlerts = await Alert.countDocuments({ status: 'resolved' });
        
        // Get alerts by type
        const policeAlerts = await Alert.countDocuments({ type: 'police' });
        const ambulanceAlerts = await Alert.countDocuments({ type: 'ambulance' });
        const fireAlerts = await Alert.countDocuments({ type: 'fire' });

        // Get today's alerts
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayAlerts = await Alert.countDocuments({
            createdAt: { $gte: today }
        });

        // Average response time
        const alertsWithResponse = await Alert.find({
            responseTime: { $exists: true }
        });

        let avgResponseTime = 0;
        if (alertsWithResponse.length > 0) {
            const totalResponseTime = alertsWithResponse.reduce((acc, alert) => {
                const responseTime = (alert.responseTime - alert.createdAt) / 1000 / 60; // in minutes
                return acc + responseTime;
            }, 0);
            avgResponseTime = totalResponseTime / alertsWithResponse.length;
        }

        res.status(200).json({
            success: true,
            data: {
                total: totalAlerts,
                byStatus: {
                    pending: pendingAlerts,
                    acknowledged: acknowledgedAlerts,
                    resolved: resolvedAlerts
                },
                byType: {
                    police: policeAlerts,
                    ambulance: ambulanceAlerts,
                    fire: fireAlerts
                },
                today: todayAlerts,
                avgResponseTime: Math.round(avgResponseTime * 10) / 10 // Round to 1 decimal
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            details: error.message
        });
    }
};