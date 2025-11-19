const FireStation = require('../models/FireStation');
const jwt = require('jsonwebtoken');

// Helper function to extract coordinates from Google Maps link
function extractCoordinates(googleLink) {
  try {
    // Pattern 1: https://maps.google.com/?q=6.9271,79.8612
    const pattern1 = /q=([-\d.]+),([-\d.]+)/;
    const match1 = googleLink.match(pattern1);
    if (match1) {
      return { lat: parseFloat(match1[1]), lng: parseFloat(match1[2]) };
    }

    // Pattern 2: https://www.google.com/maps/place/6.9271,79.8612
    const pattern2 = /place\/([-\d.]+),([-\d.]+)/;
    const match2 = googleLink.match(pattern2);
    if (match2) {
      return { lat: parseFloat(match2[1]), lng: parseFloat(match2[2]) };
    }

    // Pattern 3: https://maps.app.goo.gl or short links - extract from @lat,lng
    const pattern3 = /@([-\d.]+),([-\d.]+)/;
    const match3 = googleLink.match(pattern3);
    if (match3) {
      return { lat: parseFloat(match3[1]), lng: parseFloat(match3[2]) };
    }

    throw new Error('Could not extract coordinates from Google Maps link');
  } catch (error) {
    throw new Error('Invalid Google Maps link format');
  }
}

// Register fire station
exports.registerFireStation = async (req, res) => {
  try {
    const { stationName, phone, googleLink } = req.body;

    console.log('🔥 Fire station registration request:', { stationName, phone });

    // Validation
    if (!stationName || !phone || !googleLink) {
      return res.status(400).json({
        success: false,
        error: 'Station name, phone, and Google Maps link are required'
      });
    }

    // Check if station already exists
    const existingStation = await FireStation.findOne({ phone });
    if (existingStation) {
      return res.status(400).json({
        success: false,
        error: 'Fire station with this phone number already exists'
      });
    }

    // Extract coordinates from Google Maps link
    const { lat, lng } = extractCoordinates(googleLink);

    console.log('📍 Extracted coordinates:', { lat, lng });

    // Create new fire station
    const fireStation = new FireStation({
      stationName,
      phone,
      lat,
      lng,
      googleLink
    });

    await fireStation.save();

    console.log('✅ Fire station registered successfully:', fireStation._id);

    res.status(201).json({
      success: true,
      message: 'Fire station registered successfully',
      data: {
        id: fireStation._id,
        stationName: fireStation.stationName,
        phone: fireStation.phone,
        lat: fireStation.lat,
        lng: fireStation.lng
      }
    });

  } catch (error) {
    console.error('❌ Fire station registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register fire station'
    });
  }
};

// Login fire station
exports.loginFireStation = async (req, res) => {
  try {
    const { phone } = req.body;

    console.log('🔥 Fire station login attempt:', { phone });

    // Validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Find station by phone
    const station = await FireStation.findOne({ phone, isActive: true });

    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Fire station not found or inactive'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: station._id, 
        phone: station.phone,
        type: 'fire'
      },
      process.env.JWT_SECRET || 'rapidaid-secret-key-2024',
      { expiresIn: '30d' }
    );

    console.log('✅ Fire station logged in:', station.stationName);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: station._id,
        stationName: station.stationName,
        phone: station.phone,
        lat: station.lat,
        lng: station.lng
      }
    });

  } catch (error) {
    console.error('❌ Fire station login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

// Update FCM token for fire station
exports.updateFCMToken = async (req, res) => {
  try {
    const { stationId, fcmToken } = req.body;

    console.log('🔥 Updating FCM token for fire station:', stationId);

    if (!stationId || !fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'Station ID and FCM token are required'
      });
    }

    const station = await FireStation.findByIdAndUpdate(
      stationId,
      { fcmToken },
      { new: true }
    );

    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Fire station not found'
      });
    }

    console.log('✅ FCM token updated for fire station:', station.stationName);

    res.status(200).json({
      success: true,
      message: 'FCM token updated successfully'
    });

  } catch (error) {
    console.error('❌ FCM token update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update FCM token'
    });
  }
};

// Get all fire stations (for Flutter map)
exports.getAllFireStations = async (req, res) => {
  try {
    const stations = await FireStation.find({ isActive: true })
      .select('stationName phone lat lng')
      .lean();

    console.log(`🔥 Retrieved ${stations.length} fire stations`);

    res.status(200).json({
      success: true,
      count: stations.length,
      data: stations
    });

  } catch (error) {
    console.error('❌ Error fetching fire stations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fire stations'
    });
  }
};

// Get fire station by ID
exports.getFireStationById = async (req, res) => {
  try {
    const { id } = req.params;

    const station = await FireStation.findById(id);

    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Fire station not found'
      });
    }

    res.status(200).json({
      success: true,
      data: station
    });

  } catch (error) {
    console.error('❌ Error fetching fire station:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fire station'
    });
  }
};