const express = require('express');
const pool = require('./db');
const authenticateToken = require('./middleware/auth');
const adminRoutes = require('./routes/admin');
const recipeRoutes = require('./routes/recipes');
const { json } = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(json()); // For parsing JSON requests

// Mount routes
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/recipes', authenticateToken, recipeRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
