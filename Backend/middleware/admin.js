function authorizeAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

module.exports = authorizeAdmin;