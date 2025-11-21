const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Alert type is required'],
        enum: ['police', 'ambulance', 'fire'], 
        default: 'police'
    },
    userPhone: {
        type: String,
        trim: true
    },
    lat: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
    },
    lng: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
    },
    stationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PoliceStation',
        required: false
    },
    stationName: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'acknowledged', 'resolved', 'cancelled'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'high'
    },
    description: {
        type: String,
        trim: true
    },
    responseTime: {
        type: Date
    },
    resolvedTime: {
        type: Date
    },
    distance: {
        type: Number, // Distance to nearest station in km
    },
    notificationSent: {
        type: Boolean,
        default: false
    },
    
    // ✅ NEW: Smart Alert Aggregation Fields
    isAggregated: {
        type: Boolean,
        default: false
    },
    parentAlertId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert',
        default: null
    },
    reportCount: {
        type: Number,
        default: 1 // Starts with the first report
    },
    reporters: [{
        userId: {
            type: String,
            required: true
        },
        userPhone: {
            type: String
        },
        reportedAt: {
            type: Date,
            default: Date.now
        },
        location: {
            lat: Number,
            lng: Number
        }
    }],
    
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
alertSchema.index({ userId: 1, createdAt: -1 });
alertSchema.index({ stationId: 1, status: 1 });
alertSchema.index({ type: 1, status: 1 });
alertSchema.index({ createdAt: -1 });
// ✅ NEW: Index for geospatial aggregation queries
alertSchema.index({ lat: 1, lng: 1, type: 1, status: 1, createdAt: -1 });
alertSchema.index({ isAggregated: 1, parentAlertId: 1 });

// Method to mark alert as acknowledged
alertSchema.methods.acknowledge = function () {
    this.status = 'acknowledged';
    this.responseTime = new Date();
    return this.save();
};

// Method to resolve alert
alertSchema.methods.resolve = function () {
    this.status = 'resolved';
    this.resolvedTime = new Date();
    return this.save();
};

// ✅ NEW: Method to add a reporter to existing alert
alertSchema.methods.addReporter = function (userId, userPhone, lat, lng) {
    // Check if this user already reported this alert
    const alreadyReported = this.reporters.some(reporter => reporter.userId === userId);
    
    if (alreadyReported) {
        return { success: false, message: 'User already reported this incident' };
    }
    
    this.reporters.push({
        userId,
        userPhone,
        reportedAt: new Date(),
        location: { lat, lng }
    });
    this.reportCount = this.reporters.length;
    
    return this.save();
};

// Static method to get recent alerts
alertSchema.statics.getRecentAlerts = function (limit = 50) {
    return this.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('stationId', 'stationName phone lat lng');
};

// Static method to get alerts by station
alertSchema.statics.getAlertsByStation = function (stationId, status = null) {
    const query = { stationId };
    if (status) query.status = status;

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(100);
};

// ✅ NEW: Static method to find nearby recent alerts
alertSchema.statics.findNearbyRecentAlert = async function(lat, lng, type, radiusInMeters = 10, timeWindowSeconds = 90) {
    const now = new Date();
    const timeThreshold = new Date(now.getTime() - (timeWindowSeconds * 1000));
    
    // Find all recent alerts of the same type within time window
    const recentAlerts = await this.find({
        type: type,
        status: { $in: ['pending', 'acknowledged'] }, // Only active alerts
        isAggregated: false, // Only parent alerts, not aggregated ones
        createdAt: { $gte: timeThreshold }
    });
    
    // Calculate distances and find nearby alerts
    for (const alert of recentAlerts) {
        const distance = calculateDistance(lat, lng, alert.lat, alert.lng);
        const distanceInMeters = distance * 1000; // Convert km to meters
        
        if (distanceInMeters <= radiusInMeters) {
            return alert; // Found a nearby alert
        }
    }
    
    return null; // No nearby alert found
};

// Haversine formula for distance calculation (returns distance in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

module.exports = mongoose.model('Alert', alertSchema);