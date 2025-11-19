const FireStation = require('../models/FireStation');
const jwt = require('jsonwebtoken');

// ======================================================================
// IMPROVED HELPER FUNCTION with detailed error logging
// ======================================================================
function extractCoordinates(googleLink) {
  console.log('🔍 Attempting to extract coordinates from:', googleLink);
  
  try {
    // Pattern 1: https://maps.google.com/?q=6.9271,79.8612
    const pattern1 = /q=([-\d.]+),([-\d.]+)/;
    const match1 = googleLink.match(pattern1);
    if (match1) {
      console.log('✅ Matched Pattern 1 (?q=lat,lng)');
      return { lat: parseFloat(match1[1]), lng: parseFloat(match1[2]) };
    }

    // Pattern 2: https://www.google.com/maps/place/6.9271,79.8612
    const pattern2 = /place\/([-\d.]+),([-\d.]+)/;
    const match2 = googleLink.match(pattern2);
    if (match2) {
      console.log('✅ Matched Pattern 2 (/place/lat,lng)');
      return { lat: parseFloat(match2[1]), lng: parseFloat(match2[2]) };
    }

    // Pattern 3: https://maps.app.goo.gl or short links - extract from @lat,lng
    const pattern3 = /@([-\d.]+),([-\d.]+)/;
    const match3 = googleLink.match(pattern3);
    if (match3) {
      console.log('✅ Matched Pattern 3 (@lat,lng)');
      return { lat: parseFloat(match3[1]), lng: parseFloat(match3[2]) };
    }

    // Pattern 4: https://www.google.com/maps/@lat,lng,zoom
    const pattern4 = /@([-\d.]+),([-\d.]+),[\d.]+z/;
    const match4 = googleLink.match(pattern4);
    if (match4) {
      console.log('✅ Matched Pattern 4 (/@lat,lng,zoom)');
      return { lat: parseFloat(match4[1]), lng: parseFloat(match4[2]) };
    }

    // No pattern matched
    console.error('❌ No pattern matched for link:', googleLink);
    console.error('Expected formats:');
    console.error('  1. https://maps.google.com/?q=6.9271,79.8612');
    console.error('  2. https://www.google.com/maps/place/6.9271,79.8612');
    console.error('  3. https://www.google.com/maps/@6.9271,79.8612,17z');
    console.error('  4. https://maps.app.goo.gl/xxxxx (with @lat,lng)');
    
    throw new Error(
      'Could not extract coordinates from Google Maps link. ' +
      'Please use a link with coordinates like: ' +
      'https://www.google.com/maps/place/7.0119976,79.9535591'
    );
    
  } catch (error) {
    console.error('❌ extractCoordinates error:', error.message);
    throw error;
  }
}

// ======================================================================
// REGISTER FIRE STATION - with improved error handling
// ======================================================================
exports.registerFireStation = async (req, res) => {
  try {
    const { stationName, phone, googleLink } = req.body;

    console.log('\n🔥 === FIRE STATION REGISTRATION REQUEST ===');
    console.log('Station Name:', stationName);
    console.log('Phone:', phone);
    console.log('Google Link:', googleLink);
    console.log('=====================================\n');

    // Step 1: Validate required fields
    if (!stationName || !phone || !googleLink) {
      console.error('❌ Validation failed: Missing required fields');
      console.error('  - stationName:', stationName ? '✓' : '✗');
      console.error('  - phone:', phone ? '✓' : '✗');
      console.error('  - googleLink:', googleLink ? '✓' : '✗');
      
      return res.status(400).json({
        success: false,
        error: 'Station name, phone, and Google Maps link are required',
        details: {
          stationName: !stationName ? 'Station name is required' : null,
          phone: !phone ? 'Phone number is required' : null,
          googleLink: !googleLink ? 'Google Maps link is required' : null
        }
      });
    }

    // Step 2: Check if station already exists
    console.log('🔍 Checking if station with phone', phone, 'already exists...');
    const existingStation = await FireStation.findOne({ phone });
    
    if (existingStation) {
      console.warn('⚠️ Fire station already exists with phone:', phone);
      return res.status(400).json({
        success: false,
        error: 'Fire station with this phone number already exists',
        existingStation: {
          id: existingStation._id,
          name: existingStation.stationName
        }
      });
    }
    console.log('✅ No existing station found, proceeding...');

    // Step 3: Extract coordinates from Google Maps link
    let lat, lng;
    try {
      console.log('🗺️ Extracting coordinates from Google Maps link...');
      const coords = extractCoordinates(googleLink);
      lat = coords.lat;
      lng = coords.lng;
      console.log('📍 Extracted coordinates:', { lat, lng });
      
      // Validate coordinate ranges
      if (lat < -90 || lat > 90) {
        throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90`);
      }
      if (lng < -180 || lng > 180) {
        throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180`);
      }
      console.log('✅ Coordinates validated successfully');
      
    } catch (coordError) {
      console.error('❌ Coordinate extraction failed:', coordError.message);
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Maps link format',
        details: coordError.message,
        hint: 'Use a link like: https://www.google.com/maps/place/7.0119976,79.9535591'
      });
    }

    // Step 4: Create new fire station
    console.log('💾 Creating new fire station in database...');
    const fireStation = new FireStation({
      stationName,
      phone,
      lat,
      lng,
      googleLink,
      isActive: true
    });

    // Step 5: Save to database
    await fireStation.save();
    console.log('✅ Fire station registered successfully!');
    console.log('   ID:', fireStation._id);
    console.log('   Name:', fireStation.stationName);
    console.log('   Location:', `${fireStation.lat}, ${fireStation.lng}`);

    // Step 6: Send success response
    res.status(201).json({
      success: true,
      message: 'Fire station registered successfully',
      data: {
        id: fireStation._id,
        stationName: fireStation.stationName,
        phone: fireStation.phone,
        lat: fireStation.lat,
        lng: fireStation.lng,
        googleLink: fireStation.googleLink,
        isActive: fireStation.isActive,
        createdAt: fireStation.createdAt
      }
    });

  } catch (error) {
    console.error('\n❌ === FIRE STATION REGISTRATION ERROR ===');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('========================================\n');
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate entry detected',
        details: 'A fire station with this information already exists'
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register fire station',
      type: error.name
    });
  }
};

// ======================================================================
// LOGIN FIRE STATION
// ======================================================================
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
        type: 'fire',
        stationName: station.stationName
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
        lng: station.lng,
        googleLink: station.googleLink
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

// ======================================================================
// UPDATE FCM TOKEN
// ======================================================================
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

    console.log('✅ FCM token updated for:', station.stationName);

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


exports.getAllFireStations = async (req, res) => {
  try {
    const stations = await FireStation.find({ isActive: true })
      .select('stationName phone lat lng googleLink')
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

// ✅ NEW: Get nearby fire stations
exports.getNearbyFireStations = async (req, res) => {
  try {
    const { lat, lng, limit } = req.query;

    console.log('🔍 Finding nearby fire stations:', { lat, lng, limit });

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxResults = parseInt(limit) || 10;

    // Find nearest fire stations
    const nearestStations = await FireStation.findNearest(
      userLat,
      userLng,
      maxResults
    );

    if (!nearestStations || nearestStations.length === 0) {
      console.log('⚠️ No fire stations found');
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Format response
    const stations = Array.isArray(nearestStations) 
      ? nearestStations 
      : [nearestStations];

    console.log(`✅ Found ${stations.length} nearby fire stations`);

    res.status(200).json({
      success: true,
      count: stations.length,
      data: stations.map(station => ({
        id: station._id,
        stationName: station.stationName,
        phone: station.phone,
        lat: station.lat,
        lng: station.lng,
        googleLink: station.googleLink,
        distance: station.distance
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching nearby fire stations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby fire stations'
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


