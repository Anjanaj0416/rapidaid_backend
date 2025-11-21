const Alert = require('../models/Alert');
const PoliceStation = require('../models/PoliceStation');
const User = require('../models/User');
const FireStation = require('../models/FireStation');
const HealthCenter = require('../models/HealthCenter');
const admin = require('../config/firebase');

// ✅ NEW: Helper function to check for nearby alerts and aggregate
async function checkAndAggregateAlert(userId, userPhone, type, lat, lng) {
    console.log('🔍 Checking for nearby recent alerts...');
    
    // Look for alerts within 10 meters and 90 seconds
    const nearbyAlert = await Alert.findNearbyRecentAlert(
        parseFloat(lat),
        parseFloat(lng),
        type,
        10, // 10 meters radius
        90  // 90 seconds time window
    );
    
    if (nearbyAlert) {
        console.log('✅ Found nearby alert! Aggregating reports...');
        console.log('   Parent Alert ID:', nearbyAlert._id);
        console.log('   Current report count:', nearbyAlert.reportCount);
        
        // Add this user as a reporter to the existing alert
        await nearbyAlert.addReporter(userId, userPhone, parseFloat(lat), parseFloat(lng));
        
        console.log('✅ Alert aggregated! New report count:', nearbyAlert.reportCount);
        
        return {
            isAggregated: true,
            parentAlert: nearbyAlert,
            reportCount: nearbyAlert.reportCount
        };
    }
    
    console.log('ℹ️ No nearby alert found. Creating new alert...');
    return { isAggregated: false };
}

// Send police alert with smart aggregation
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

        // ✅ NEW: Check for nearby recent alerts
        const aggregationResult = await checkAndAggregateAlert(
            userId || 'ANONYMOUS',
            userPhone,
            'police',
            lat,
            lng
        );

        if (aggregationResult.isAggregated) {
            // Return the aggregated alert
            return res.status(200).json({
                success: true,
                message: 'Your report has been added to an existing incident',
                isAggregated: true,
                reportCount: aggregationResult.reportCount,
                data: aggregationResult.parentAlert
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

        // Create new alert record
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
            priority: 'high',
            isAggregated: false,
            reportCount: 1,
            reporters: [{
                userId: userId || 'ANONYMOUS',
                userPhone: userPhone || null,
                reportedAt: new Date(),
                location: { lat: parseFloat(lat), lng: parseFloat(lng) }
            }]
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
                        body: `Emergency at ${nearestStation.distance.toFixed(2)} km away. Tap to view details.`,
                    },
                    data: {
                        alertId: alert._id.toString(),
                        type: 'police',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        userPhone: userPhone || '',
                        distance: nearestStation.distance.toString()
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'emergency_alerts'
                        }
                    }
                };

                await admin.messaging().send(message);
                notificationSent = true;
                console.log('✅ FCM notification sent successfully');
            } catch (fcmError) {
                console.error('⚠️ FCM notification failed:', fcmError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Police alert sent successfully',
            isAggregated: false,
            reportCount: 1,
            data: {
                alert,
                station: {
                    id: nearestStation._id,
                    name: nearestStation.stationName,
                    distance: nearestStation.distance
                },
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

// Send fire alert with smart aggregation
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

        // ✅ NEW: Check for nearby recent alerts
        const aggregationResult = await checkAndAggregateAlert(
            userId || 'ANONYMOUS',
            userPhone,
            'fire',
            lat,
            lng
        );

        if (aggregationResult.isAggregated) {
            // Return the aggregated alert
            return res.status(200).json({
                success: true,
                message: 'Your report has been added to an existing incident',
                isAggregated: true,
                reportCount: aggregationResult.reportCount,
                data: aggregationResult.parentAlert
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

        // Create new alert record
        const alert = new Alert({
            userId: userId || 'ANONYMOUS',
            userPhone: userPhone || null,
            type: 'fire',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            stationId: nearestStation._id,
            stationName: nearestStation.stationName,
            description: description || 'Fire emergency - assistance required',
            distance: nearestStation.distance,
            priority: 'critical',
            isAggregated: false,
            reportCount: 1,
            reporters: [{
                userId: userId || 'ANONYMOUS',
                userPhone: userPhone || null,
                reportedAt: new Date(),
                location: { lat: parseFloat(lat), lng: parseFloat(lng) }
            }]
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
                        title: '🔥 FIRE EMERGENCY',
                        body: `Fire reported at ${nearestStation.distance.toFixed(2)} km away. Immediate response required!`,
                    },
                    data: {
                        alertId: alert._id.toString(),
                        type: 'fire',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        userPhone: userPhone || '',
                        distance: nearestStation.distance.toString()
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'emergency_alerts'
                        }
                    }
                };

                await admin.messaging().send(message);
                notificationSent = true;
                console.log('✅ FCM notification sent successfully');
            } catch (fcmError) {
                console.error('⚠️ FCM notification failed:', fcmError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Fire alert sent successfully',
            isAggregated: false,
            reportCount: 1,
            data: {
                alert,
                station: {
                    id: nearestStation._id,
                    name: nearestStation.stationName,
                    distance: nearestStation.distance
                },
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

// Send ambulance alert with smart aggregation
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

        // ✅ NEW: Check for nearby recent alerts
        const aggregationResult = await checkAndAggregateAlert(
            userId || 'ANONYMOUS',
            userPhone,
            'ambulance',
            lat,
            lng
        );

        if (aggregationResult.isAggregated) {
            // Return the aggregated alert
            return res.status(200).json({
                success: true,
                message: 'Your report has been added to an existing incident',
                isAggregated: true,
                reportCount: aggregationResult.reportCount,
                data: aggregationResult.parentAlert
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

        // Create new alert record
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
            priority: 'critical',
            isAggregated: false,
            reportCount: 1,
            reporters: [{
                userId: userId || 'ANONYMOUS',
                userPhone: userPhone || null,
                reportedAt: new Date(),
                location: { lat: parseFloat(lat), lng: parseFloat(lng) }
            }]
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
                        body: `Medical emergency at ${nearestCenter.distance.toFixed(2)} km away. Immediate response needed!`,
                    },
                    data: {
                        alertId: alert._id.toString(),
                        type: 'ambulance',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        userPhone: userPhone || '',
                        distance: nearestCenter.distance.toString()
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'emergency_alerts'
                        }
                    }
                };

                await admin.messaging().send(message);
                notificationSent = true;
                console.log('✅ FCM notification sent successfully');
            } catch (fcmError) {
                console.error('⚠️ FCM notification failed:', fcmError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Ambulance alert sent successfully',
            isAggregated: false,
            reportCount: 1,
            data: {
                alert,
                center: {
                    id: nearestCenter._id,
                    name: nearestCenter.centerName,
                    distance: nearestCenter.distance
                },
                notificationSent
            }
        });

    } catch (error) {
        console.error('❌ Ambulance alert error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send ambulance alert'
        });
    }
};

// ✅ Get all alerts with optional type filtering (unchanged)
exports.getAllAlerts = async (req, res) => {
    try {
        const { type, limit = 100 } = req.query;

        console.log('🔥 Fetching alerts with filters:', { type, limit });

        const query = { isAggregated: false }; // ✅ Only show parent alerts, not aggregated ones
        if (type) {
            query.type = type;
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
        const { type } = req.query;

        const query = { stationId, isAggregated: false }; // ✅ Only parent alerts
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
                error: 'Invalid status. Must be one of: pending, acknowledged, en-route, resolved'
            });
        }

        const alert = await Alert.findByIdAndUpdate(
            id,
            { status, responseTime: status === 'acknowledged' ? new Date() : undefined },
            { new: true, runValidators: true }
        );

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Alert status updated to ${status}`,
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

// Acknowledge alert
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

module.exports = exports;