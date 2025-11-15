// Validate phone number format
exports.validatePhone = (req, res, next) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({
            success: false,
            error: 'Phone number is required'
        });
    }

    if (!/^[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a valid 10-digit phone number'
        });
    }

    next();
};

// Validate coordinates
exports.validateCoordinates = (req, res, next) => {
    const { lat, lng } = req.body;
    
    if (lat === undefined || lng === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Latitude and longitude are required'
        });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
            success: false,
            error: 'Latitude and longitude must be valid numbers'
        });
    }

    if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
            success: false,
            error: 'Latitude must be between -90 and 90'
        });
    }

    if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
            success: false,
            error: 'Longitude must be between -180 and 180'
        });
    }

    next();
};

// Validate alert type
exports.validateAlertType = (req, res, next) => {
    const { type } = req.body;
    
    const validTypes = ['police', 'ambulance', 'fire'];
    
    if (type && !validTypes.includes(type)) {
        return res.status(400).json({
            success: false,
            error: `Invalid alert type. Must be one of: ${validTypes.join(', ')}`
        });
    }

    next();
};

// Validate MongoDB ObjectId
exports.validateObjectId = (paramName) => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }

        next();
    };
};

// Validate station registration
exports.validateStationRegistration = (req, res, next) => {
    const { stationName, phone, lat, lng, googleLink } = req.body;
    
    const errors = [];

    if (!stationName) {
        errors.push('Station name is required');
    }

    if (!phone) {
        errors.push('Phone number is required');
    } else if (!/^[0-9]{10}$/.test(phone)) {
        errors.push('Phone must be a valid 10-digit number');
    }

    // Either googleLink or (lat && lng) must be provided
    if (!googleLink && (!lat || !lng)) {
        errors.push('Either Google Maps link or coordinates (lat/lng) must be provided');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors
        });
    }

    next();
};

// Sanitize input to prevent XSS and injection
exports.sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potential harmful characters
                obj[key] = obj[key]
                    .replace(/[<>]/g, '') // Remove < and >
                    .trim();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
};