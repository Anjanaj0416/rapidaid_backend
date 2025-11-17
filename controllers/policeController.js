const PoliceStation = require('../models/PoliceStation');
const jwt = require('jsonwebtoken');

// Helper function to extract coordinates from Google Maps link
const extractCoordinates = (googleMapsLink) => {
    try {
        let lat = null;
        let lng = null;

        // Method 1: Check for @ coordinates (most common in full Google Maps URLs)
        const atMatch = googleMapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
            lat = parseFloat(atMatch[1]);
            lng = parseFloat(atMatch[2]);
            console.log('✅ Extracted coordinates using @ pattern:', { lat, lng });
            return { lat, lng };
        }

        // Method 2: Check for /place/ with coordinates
        const placeMatch = googleMapsLink.match(/\/place\/[^/]+\/@?(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (placeMatch) {
            lat = parseFloat(placeMatch[1]);
            lng = parseFloat(placeMatch[2]);
            console.log('✅ Extracted coordinates using place pattern:', { lat, lng });
            return { lat, lng };
        }

        // Method 3: Check for ?q= parameter
        const qMatch = googleMapsLink.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qMatch) {
            lat = parseFloat(qMatch[1]);
            lng = parseFloat(qMatch[2]);
            console.log('✅ Extracted coordinates using q parameter:', { lat, lng });
            return { lat, lng };
        }

        console.warn('⚠️ Could not extract coordinates from link:', googleMapsLink);
        return { lat: null, lng: null };

    } catch (error) {
        console.error('❌ Error extracting coordinates:', error);
        return { lat: null, lng: null };
    }
};

// Register new police station
exports.registerStation = async (req, res) => {
    try {
        const { stationName, phone, googleMapsLink, district, lat: providedLat, lng: providedLng } = req.body;

        console.log('📝 Registration request received:', {
            stationName,
            phone,
            googleMapsLink: googleMapsLink?.substring(0, 50) + '...',
            providedCoordinates: providedLat && providedLng ? { lat: providedLat, lng: providedLng } : 'Not provided'
        });

        // Validation
        if (!stationName || !phone || !googleMapsLink) {
            return res.status(400).json({
                success: false,
                error: 'Station name, phone number, and Google Maps link are required'
            });
        }

        // Check if phone already exists
        const existingStation = await PoliceStation.findOne({ phone });
        if (existingStation) {
            return res.status(400).json({
                success: false,
                error: 'A police station with this phone number already exists'
            });
        }

        let lat, lng;

        // OPTION 1: Use coordinates provided by frontend (if available)
        if (providedLat && providedLng) {
            lat = parseFloat(providedLat);
            lng = parseFloat(providedLng);
            console.log('✅ Using coordinates from frontend:', { lat, lng });
        } 
        // OPTION 2: Extract coordinates from Google Maps link
        else {
            const extracted = extractCoordinates(googleMapsLink);
            lat = extracted.lat;
            lng = extracted.lng;
        }

        // Check if we have valid coordinates
        if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({
                success: false,
                error: 'Could not extract coordinates from Google Maps link',
                hint: 'Please use a Google Maps share link in one of these formats:',
                validFormats: [
                    'https://maps.app.goo.gl/xxxxx',
                    'https://www.google.com/maps/place/Police+Station/@7.067,79.959,17z',
                    'https://goo.gl/maps/xxxxx'
                ],
                providedLink: googleMapsLink,
                suggestion: 'Try these steps: 1) Open Google Maps, 2) Search for your police station, 3) Click Share button, 4) Copy the link shown'
            });
        }

        // Validate coordinates are reasonable (Sri Lanka bounds approximately)
        if (lat < 5.9 || lat > 10.0 || lng < 79.0 || lng > 82.0) {
            return res.status(400).json({
                success: false,
                error: 'Coordinates seem invalid for Sri Lanka',
                extractedCoordinates: { lat, lng },
                hint: 'Please verify the Google Maps link is for a location in Sri Lanka'
            });
        }

        // Extract address from the link or use a default
        let address = '';
        try {
            const addressMatch = googleMapsLink.match(/\/place\/([^/@]+)/);
            if (addressMatch) {
                address = decodeURIComponent(addressMatch[1]).replace(/\+/g, ' ');
            }
        } catch (e) {
            console.warn('Could not extract address from link');
        }

        // Create new police station
        const newStation = new PoliceStation({
            stationName,
            phone,
            lat,
            lng,
            address: address || 'Address not available',
            district: district || 'Not specified',
            googleMapsLink,
            isActive: true
        });

        await newStation.save();

        console.log('✅ Police station registered successfully:', {
            id: newStation._id,
            name: stationName,
            coordinates: { lat, lng }
        });

        // Generate JWT token
        const token = jwt.sign(
            { stationId: newStation._id, phone: newStation.phone },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            message: 'Police station registered successfully',
            token,
            station: {
                id: newStation._id,
                stationName: newStation.stationName,
                phone: newStation.phone,
                lat: newStation.lat,
                lng: newStation.lng,
                address: newStation.address,
                district: newStation.district
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'A police station with this phone number already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Registration failed',
            details: error.message
        });
    }
};

// Login police station
exports.loginStation = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const station = await PoliceStation.findOne({ phone, isActive: true });

        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found with this phone number'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { stationId: station._id, phone: station.phone },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            station: {
                id: station._id,
                stationName: station.stationName,
                phone: station.phone,
                lat: station.lat,
                lng: station.lng,
                address: station.address,
                district: station.district
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            details: error.message
        });
    }
};

// Update FCM token for police station
exports.updateFCMToken = async (req, res) => {
    try {
        const { stationId, fcmToken } = req.body;

        if (!stationId || !fcmToken) {
            return res.status(400).json({
                success: false,
                error: 'Station ID and FCM token are required'
            });
        }

        const station = await PoliceStation.findById(stationId);
        
        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found'
            });
        }

        station.fcmToken = fcmToken;
        await station.save();

        res.status(200).json({
            success: true,
            message: 'FCM token updated successfully'
        });

    } catch (error) {
        console.error('Token update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update FCM token',
            details: error.message
        });
    }
};

// Get all police stations (with optional location filtering)
exports.getAllStations = async (req, res) => {
    try {
        const { lat, lng, limit } = req.query;

        let stations = await PoliceStation.find({ isActive: true })
            .select('-fcmToken -__v')
            .sort({ stationName: 1 });

        // If user location is provided, calculate distances
        if (lat && lng) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);

            stations = stations.map(station => {
                const distance = calculateDistance(
                    userLat,
                    userLng,
                    station.lat,
                    station.lng
                );

                return {
                    ...station.toObject(),
                    distance: parseFloat(distance.toFixed(2))
                };
            });

            // Sort by distance
            stations.sort((a, b) => a.distance - b.distance);

            // Limit results if specified
            if (limit) {
                stations = stations.slice(0, parseInt(limit));
            }
        }

        res.status(200).json({
            success: true,
            count: stations.length,
            data: stations
        });

    } catch (error) {
        console.error('Get stations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch police stations',
            details: error.message
        });
    }
};

// Get single police station details
exports.getStationById = async (req, res) => {
    try {
        const { id } = req.params;

        const station = await PoliceStation.findById(id)
            .select('-fcmToken -__v');

        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found'
            });
        }

        res.status(200).json({
            success: true,
            data: station
        });

    } catch (error) {
        console.error('Get station error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch police station',
            details: error.message
        });
    }
};

// Update police station details
exports.updateStation = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow updating certain fields
        delete updates._id;
        delete updates.phone;
        delete updates.createdAt;

        const station = await PoliceStation.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).select('-fcmToken -__v');

        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Police station updated successfully',
            data: station
        });

    } catch (error) {
        console.error('Update station error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update police station',
            details: error.message
        });
    }
};

// Delete (deactivate) police station
exports.deleteStation = async (req, res) => {
    try {
        const { id } = req.params;

        const station = await PoliceStation.findById(id);

        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found'
            });
        }

        // Soft delete - just mark as inactive
        station.isActive = false;
        await station.save();

        res.status(200).json({
            success: true,
            message: 'Police station deactivated successfully'
        });

    } catch (error) {
        console.error('Delete station error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete police station',
            details: error.message
        });
    }
};

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}