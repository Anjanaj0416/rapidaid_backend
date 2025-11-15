const PoliceStation = require('../models/PoliceStation');
const jwt = require('jsonwebtoken');

// Helper function to extract coordinates from Google Maps link
const extractCoordinatesFromLink = (googleLink) => {
    try {
        // Pattern 1: https://maps.google.com/?q=6.9271,79.8612
        let match = googleLink.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
            return {
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2])
            };
        }

        // Pattern 2: https://www.google.com/maps/place/@6.9271,79.8612
        match = googleLink.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
            return {
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2])
            };
        }

        // Pattern 3: https://goo.gl/maps/... or shortened URLs
        // For shortened URLs, you'd need to make an HTTP request to get the full URL
        // This is a simplified version

        return null;
    } catch (error) {
        console.error('Error extracting coordinates:', error);
        return null;
    }
};

// Register new police station
exports.registerStation = async (req, res) => {
    try {
        const { stationName, phone, googleLink, lat, lng, address, district } = req.body;

        // Validation
        if (!stationName || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Station name and phone number are required'
            });
        }

        // Check if station already exists
        const existingStation = await PoliceStation.findOne({ phone });
        if (existingStation) {
            return res.status(409).json({
                success: false,
                error: 'Police station with this phone number already exists'
            });
        }

        let coordinates = { lat, lng };

        // If Google Maps link is provided, extract coordinates
        if (googleLink && (!lat || !lng)) {
            const extracted = extractCoordinatesFromLink(googleLink);
            if (extracted) {
                coordinates = extracted;
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Could not extract coordinates from Google Maps link. Please provide lat/lng manually.'
                });
            }
        }

        // Validate coordinates
        if (!coordinates.lat || !coordinates.lng) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        // Create new police station
        const newStation = new PoliceStation({
            stationName,
            phone,
            lat: coordinates.lat,
            lng: coordinates.lng,
            googleLink,
            address,
            district
        });

        await newStation.save();

        res.status(201).json({
            success: true,
            message: 'Police station registered successfully',
            data: {
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
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register police station',
            details: error.message
        });
    }
};

// Login police station (phone number only - development mode)
exports.loginStation = async (req, res) => {
    try {
        const { phone } = req.body;

        // Validation
        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Find police station
        const station = await PoliceStation.findOne({ phone, isActive: true });
        
        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found or inactive'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                stationId: station._id,
                phone: station.phone,
                stationName: station.stationName
            },
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
                const stationObj = station.toObject();
                const distance = calculateDistance(
                    userLat, userLng,
                    station.lat, station.lng
                );
                return { ...stationObj, distance };
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

        // Remove sensitive fields from updates
        delete updates.phone;
        delete updates.fcmToken;

        const station = await PoliceStation.findByIdAndUpdate(
            id,
            { ...updates, updatedAt: Date.now() },
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

        const station = await PoliceStation.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Police station not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Police station deactivated successfully'
        });

    } catch (error) {
        console.error('Delete station error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deactivate police station',
            details: error.message
        });
    }
};

// Helper function to calculate distance (Haversine formula)
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
    
    return parseFloat(distance.toFixed(2)); // Distance in kilometers, rounded to 2 decimals
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}