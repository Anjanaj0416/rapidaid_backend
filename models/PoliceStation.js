const mongoose = require('mongoose');

const policeStationSchema = new mongoose.Schema({
    stationName: {
        type: String,
        required: [true, 'Station name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
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
    googleLink: {
        type: String,
        trim: true
    },
    fcmToken: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    address: {
        type: String,
        trim: true
    },
    district: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for geospatial queries - SINGLE INDEX DEFINITION
policeStationSchema.index({ lat: 1, lng: 1 });

// Method to update FCM token
policeStationSchema.methods.updateFCMToken = function(token) {
    this.fcmToken = token;
    return this.save();
};

// Static method to find nearest station
policeStationSchema.statics.findNearest = function(userLat, userLng, limit = 1) {
    return this.find({ isActive: true })
        .then(stations => {
            // Calculate distance for each station
            const stationsWithDistance = stations.map(station => {
                const distance = calculateDistance(
                    userLat, userLng,
                    station.lat, station.lng
                );
                return {
                    ...station.toObject(),
                    distance
                };
            });

            // Sort by distance
            stationsWithDistance.sort((a, b) => a.distance - b.distance);

            // Return top results
            return limit === 1 ? stationsWithDistance[0] : stationsWithDistance.slice(0, limit);
        });
};

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // Distance in kilometers
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

module.exports = mongoose.model('PoliceStation', policeStationSchema);