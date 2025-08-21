const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains user_id and is_admin
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = authenticateToken;