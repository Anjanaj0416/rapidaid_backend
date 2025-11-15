const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    name: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    fcmToken: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    emergencyContacts: [{
        name: String,
        phone: String,
        relationship: String
    }],
    medicalInfo: {
        bloodType: String,
        allergies: [String],
        medications: [String],
        conditions: [String]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster phone lookups - SINGLE INDEX DEFINITION
userSchema.index({ phone: 1 }, { unique: true });

// Method to update last login
userSchema.methods.updateLastLogin = function() {
    this.lastLogin = new Date();
    return this.save();
};

// Method to update FCM token
userSchema.methods.updateFCMToken = function(token) {
    this.fcmToken = token;
    return this.save();
};

module.exports = mongoose.model('User', userSchema);