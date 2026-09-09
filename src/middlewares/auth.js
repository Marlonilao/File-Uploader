function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();

  // Remember where they were headed so login can send them back there.
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

module.exports = { requireAuth };
