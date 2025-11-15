const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
exports.verifyToken = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided. Access denied.'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Add user/station info to request
        req.user = decoded;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            details: error.message
        });
    }
};

// Middleware to verify police station token
exports.verifyPoliceStation = (req, res, next) => {
    try {
        if (!req.user || !req.user.stationId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Police station authentication required.'
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Authorization failed',
            details: error.message
        });
    }
};

// Middleware to verify user token
exports.verifyUser = (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. User authentication required.'
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Authorization failed',
            details: error.message
        });
    }
};