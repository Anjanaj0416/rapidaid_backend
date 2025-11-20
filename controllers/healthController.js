const HealthCenter = require('../models/HealthCenter');

// Helper function to extract coordinates from Google Maps link
function extractCoordinates(googleLink) {
  try {
    // Pattern 1: @lat,lng,zoom format
    const pattern1 = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match1 = googleLink.match(pattern1);
    
    if (match1) {
      return {
        lat: parseFloat(match1[1]),
        lng: parseFloat(match1[2])
      };
    }

    // Pattern 2: query string format (?q=lat,lng)
    const pattern2 = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match2 = googleLink.match(pattern2);
    
    if (match2) {
      return {
        lat: parseFloat(match2[1]),
        lng: parseFloat(match2[2])
      };
    }

    // Pattern 3: place format with coordinates
    const pattern3 = /place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match3 = googleLink.match(pattern3);
    
    if (match3) {
      return {
        lat: parseFloat(match3[1]),
        lng: parseFloat(match3[2])
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
}

// Register a new health center
exports.registerHealthCenter = async (req, res) => {
  try {
    const { centerName, phone, googleLink } = req.body;

    console.log('📥 Health center registration request:', { centerName, phone });

    // Validation
    if (!centerName || !phone || !googleLink) {
      return res.status(400).json({
        success: false,
        error: 'Center name, phone, and Google Maps link are required'
      });
    }

    // Check if phone already exists
    const existingCenter = await HealthCenter.findOne({ phone });
    if (existingCenter) {
      return res.status(409).json({
        success: false,
        error: 'A health center with this phone number already exists'
      });
    }

    // Extract coordinates from Google Maps link
    const coordinates = extractCoordinates(googleLink);
    
    if (!coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Maps link. Please provide a valid link with location coordinates.'
      });
    }

    console.log('✅ Extracted coordinates:', coordinates);

    // Create new health center
    const healthCenter = new HealthCenter({
      centerName,
      phone,
      lat: coordinates.lat,
      lng: coordinates.lng,
      googleLink,
      isActive: true
    });

    await healthCenter.save();

    console.log('✅ Health center registered successfully:', healthCenter._id);

    res.status(201).json({
      success: true,
      message: 'Health center registered successfully',
      data: {
        id: healthCenter._id,
        centerName: healthCenter.centerName,
        phone: healthCenter.phone,
        location: {
          lat: healthCenter.lat,
          lng: healthCenter.lng
        }
      }
    });

  } catch (error) {
    console.error('❌ Health center registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register health center. Please try again.'
    });
  }
};

// Login health center
exports.loginHealthCenter = async (req, res) => {
  try {
    const { phone } = req.body;

    console.log('📥 Health center login request:', { phone });

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Find health center by phone
    const healthCenter = await HealthCenter.findOne({ phone, isActive: true });

    if (!healthCenter) {
      return res.status(404).json({
        success: false,
        error: 'Health center not found. Please register first.'
      });
    }

    console.log('✅ Health center login successful:', healthCenter._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: healthCenter._id,
        centerName: healthCenter.centerName,
        phone: healthCenter.phone,
        location: {
          lat: healthCenter.lat,
          lng: healthCenter.lng
        },
        googleLink: healthCenter.googleLink
      }
    });

  } catch (error) {
    console.error('❌ Health center login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};

// Update FCM token
exports.updateFCMToken = async (req, res) => {
  try {
    const { phone, fcmToken } = req.body;

    console.log('📥 Update FCM token request:', { phone, fcmToken: fcmToken?.substring(0, 20) + '...' });

    if (!phone || !fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and FCM token are required'
      });
    }

    const healthCenter = await HealthCenter.findOneAndUpdate(
      { phone },
      { fcmToken },
      { new: true }
    );

    if (!healthCenter) {
      return res.status(404).json({
        success: false,
        error: 'Health center not found'
      });
    }

    console.log('✅ FCM token updated for health center:', healthCenter._id);

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

// Get all health centers
exports.getAllHealthCenters = async (req, res) => {
  try {
    const centers = await HealthCenter.find({ isActive: true })
      .select('-fcmToken')
      .sort({ centerName: 1 });

    console.log(`✅ Retrieved ${centers.length} health centers`);

    res.status(200).json({
      success: true,
      data: centers
    });

  } catch (error) {
    console.error('❌ Get health centers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health centers'
    });
  }
};

// Get health center by ID
exports.getHealthCenterById = async (req, res) => {
  try {
    const { id } = req.params;

    const healthCenter = await HealthCenter.findById(id).select('-fcmToken');

    if (!healthCenter) {
      return res.status(404).json({
        success: false,
        error: 'Health center not found'
      });
    }

    res.status(200).json({
      success: true,
      data: healthCenter
    });

  } catch (error) {
    console.error('❌ Get health center error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health center'
    });
  }
};

// Get nearby health centers
exports.getNearbyHealthCenters = async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;

    console.log('📍 Finding nearby health centers:', { lat, lng, limit });

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const nearestCenters = await HealthCenter.findNearest(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(limit)
    );

    if (!nearestCenters || (Array.isArray(nearestCenters) && nearestCenters.length === 0)) {
      return res.status(404).json({
        success: false,
        error: 'No health centers found nearby'
      });
    }

    const centers = Array.isArray(nearestCenters) ? nearestCenters : [nearestCenters];
    
    console.log(`✅ Found ${centers.length} nearby health centers`);

    res.status(200).json({
      success: true,
      data: centers
    });

  } catch (error) {
    console.error('❌ Get nearby health centers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find nearby health centers'
    });
  }
};