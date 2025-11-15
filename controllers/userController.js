const User = require('../models/User');
const jwt = require('jsonwebtoken');

// User login/register (phone number only)
exports.loginUser = async (req, res) => {
    try {
        const { phone, name, fcmToken } = req.body;

        // Validation
        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Validate phone format
        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid 10-digit phone number'
            });
        }

        // Find or create user
        let user = await User.findOne({ phone });

        if (!user) {
            // Create new user
            user = new User({
                phone,
                name: name || `User ${phone}`,
                fcmToken
            });
            await user.save();
        } else {
            // Update existing user
            if (name) user.name = name;
            if (fcmToken) user.fcmToken = fcmToken;
            user.lastLogin = new Date();
            await user.save();
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                phone: user.phone
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '90d' }
        );

        res.status(200).json({
            success: true,
            message: user.isNew ? 'User registered successfully' : 'Login successful',
            token,
            user: {
                id: user._id,
                phone: user.phone,
                name: user.name,
                email: user.email,
                lastLogin: user.lastLogin,
                emergencyContacts: user.emergencyContacts
            }
        });

    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            details: error.message
        });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('-fcmToken -__v');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile',
            details: error.message
        });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Remove sensitive fields
        delete updates.phone;
        delete updates.fcmToken;

        const user = await User.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        ).select('-fcmToken -__v');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile',
            details: error.message
        });
    }
};

// Update FCM token
exports.updateFCMToken = async (req, res) => {
    try {
        const { userId, fcmToken } = req.body;

        if (!userId || !fcmToken) {
            return res.status(400).json({
                success: false,
                error: 'User ID and FCM token are required'
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user.fcmToken = fcmToken;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'FCM token updated successfully'
        });

    } catch (error) {
        console.error('Update FCM token error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update FCM token',
            details: error.message
        });
    }
};

// Add emergency contact
exports.addEmergencyContact = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, phone, relationship } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Name and phone are required'
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user.emergencyContacts.push({ name, phone, relationship });
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Emergency contact added successfully',
            data: user.emergencyContacts
        });

    } catch (error) {
        console.error('Add emergency contact error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add emergency contact',
            details: error.message
        });
    }
};

// Update medical info
exports.updateMedicalInfo = async (req, res) => {
    try {
        const { userId } = req.params;
        const medicalInfo = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user.medicalInfo = { ...user.medicalInfo, ...medicalInfo };
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Medical information updated successfully',
            data: user.medicalInfo
        });

    } catch (error) {
        console.error('Update medical info error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update medical information',
            details: error.message
        });
    }
};

// Get user alert history
exports.getUserAlerts = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20 } = req.query;

        const Alert = require('../models/Alert');
        
        const alerts = await Alert.find({ userId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('stationId', 'stationName phone');

        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });

    } catch (error) {
        console.error('Get user alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user alerts',
            details: error.message
        });
    }
};

// Delete user account
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByIdAndUpdate(
            userId,
            { isActive: false },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User account deactivated successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user account',
            details: error.message
        });
    }
};