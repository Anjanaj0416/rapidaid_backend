const mongoose = require('mongoose');

const fireStationSchema = new mongoose.Schema({
  stationName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  googleLink: {
    type: String,
    required: true
  },
  fcmToken: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for geospatial queries
fireStationSchema.index({ lat: 1, lng: 1 });

// Static method to find nearest fire station
fireStationSchema.statics.findNearest = async function(userLat, userLng, limit = 1) {
  const stations = await this.find({ isActive: true });
  
  if (stations.length === 0) {
    return null;
  }

  // Calculate distances using Haversine formula
  const stationsWithDistance = stations.map(station => {
    const distance = calculateDistance(userLat, userLng, station.lat, station.lng);
    return {
      ...station.toObject(),
      distance
    };
  });

  // Sort by distance and return nearest
  stationsWithDistance.sort((a, b) => a.distance - b.distance);
  
  return limit === 1 ? stationsWithDistance[0] : stationsWithDistance.slice(0, limit);
};

// Haversine formula for distance calculation
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

module.exports = mongoose.model('FireStation', fireStationSchema);