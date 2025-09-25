const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const adminRoutes = require('./routes/admin');
const favoritesRoutes = require('./routes/favorites');
const recipeRoutes = require('./routes/recipes');
const userRoutes = require('./routes/users');
const ingredientsRoutes = require('./routes/ingredients')
const categoriesRouter = require('./routes/categories');
const errorHandler = require('./middleware/errorHandler');
const { json } = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173', // your frontend URL
  credentials: true,               // if you're sending cookies or auth headers
}));

// Middleware
app.use(
  helmet({
    // Content Security Policy: restricts sources for scripts, styles, images, etc.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],                    // Only allow content from the same origin
        scriptSrc: ["'self'", "'unsafe-inline'"], // Scripts from same origin or inline (adjust as needed)
        styleSrc: ["'self'", "'unsafe-inline'"],  // Styles from same origin or inline
        imgSrc: ["'self'", 'data:'],               // Images from same origin or embedded data URIs
        connectSrc: ["'self'"],                    // Allowed to connect (e.g., fetch API)
        fontSrc: ["'self'"],                       // Fonts from same origin
        objectSrc: ["'none'"],                     // Disallow plugins/objects for security
        upgradeInsecureRequests: [],               // Force HTTPS for all requests
      },
    },

    // Referrer Policy: restricts what referrer information is sent
    referrerPolicy: { policy: 'no-referrer' },

    // Cross-Origin Resource Policy: restricts resources from being loaded cross-site
    crossOriginResourcePolicy: { policy: 'same-site' },

    // Cross-Origin Opener Policy: isolate browsing context (optional)
    crossOriginOpenerPolicy: { policy: 'same-origin' },

    // Cross-Origin Embedder Policy: prevent attachment of cross-origin resources
    crossOriginEmbedderPolicy: { policy: 'require-corp' },

    // Hide X-Powered-By header, to obscure server technology
    hidePoweredBy: true,

    // Frameguard: prevent clickjacking
    frameguard: { action: 'deny' },

    // HSTS: enforce HTTPS (very important for production)
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },

    // Expect-CT header for Certificate Transparency
    expectCt: { maxAge: 86400, enforce: true },

    // Disable or adjust other headers as needed...
  })
);

app.use(express.json());
app.use(json()); // For parsing JSON requests

// Mount routes
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ingredients', ingredientsRoutes)
app.use('/categories', categoriesRouter);

// Error handling 
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
