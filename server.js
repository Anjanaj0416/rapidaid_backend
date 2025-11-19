require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const policeRoutes = require('./routes/policeRoutes');
const fireRoutes = require('./routes/fireRoutes');
const alertRoutes = require('./routes/alertRoutes');
const userRoutes = require('./routes/userRoutes');

// Import Firebase Admin
const admin = require('./config/firebase');

const app = express();

// ============================================
// CORS Configuration
// ============================================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins (for Flutter web)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // For production, check allowed origins
    const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',');
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.options('*', cors(corsOptions));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Routes
app.use('/api/police', policeRoutes);
app.use('/api/fire', fireRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/user', userRoutes);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'RapidAid Backend is running',
        timestamp: new Date().toISOString(),
        cors: 'enabled'
    });
});

// Root route
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'RapidAid Emergency Alert System API',
        version: '1.0.0',
        endpoints: {
            police: '/api/police',
            fire: '/api/fire',
            alerts: '/api/alerts',
            user: '/api/user'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 RapidAid Backend running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🚔 Police routes: http://localhost:${PORT}/api/police`);
    console.log(`🔥 Fire routes: http://localhost:${PORT}/api/fire`);
    console.log(`🚨 Alert routes: http://localhost:${PORT}/api/alerts`);
});

module.exports = app;