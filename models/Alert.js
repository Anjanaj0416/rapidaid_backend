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
    userPhone: {        // ✅ Add this
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
    userPhone: {
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

module.exports = mongoose.model('Alert', alertSchema);