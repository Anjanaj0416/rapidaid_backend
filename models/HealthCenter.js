const mongoose = require('mongoose');

const healthCenterSchema = new mongoose.Schema({
  centerName: {
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
  },
  // Health center specific fields
  type: {
    type: String,
    enum: ['hospital', 'clinic', 'health_center'],
    default: 'health_center'
  },
  services: {
    type: [String],
    default: ['emergency', 'ambulance']
  }
}, {
  timestamps: true
});

// Index for geospatial queries
healthCenterSchema.index({ lat: 1, lng: 1 });

// Static method to find nearest health center
healthCenterSchema.statics.findNearest = async function(userLat, userLng, limit = 1) {
  const centers = await this.find({ isActive: true });
  
  if (centers.length === 0) {
    return null;
  }

  // Calculate distances using Haversine formula
  const centersWithDistance = centers.map(center => {
    const distance = calculateDistance(userLat, userLng, center.lat, center.lng);
    return {
      ...center.toObject(),
      distance
    };
  });

  // Sort by distance and return nearest
  centersWithDistance.sort((a, b) => a.distance - b.distance);
  
  return limit === 1 ? centersWithDistance[0] : centersWithDistance.slice(0, limit);
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

module.exports = mongoose.model('HealthCenter', healthCenterSchema);