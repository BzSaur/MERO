function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Inicia sesión para continuar');
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.flash('error', 'Inicia sesión para continuar');
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.rol)) {
      return res.status(403).render('errors/403', { title: 'Acceso denegado' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
