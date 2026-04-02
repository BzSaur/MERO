const express = require('express');
const axios = require('axios');
const router = express.Router();

const API = process.env.API_URL || 'http://localhost:3000/api';

const ROLE_HOME = {
  ADMIN: '/admin',
  ENCARGADO: '/encargado',
  CONSULTOR: '/consultor',
};

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}

function destroySession(req, res) {
  const cookieName = 'connect.sid';
  const cookieOptions = { path: '/' };

  if (!req.session) {
    res.clearCookie(cookieName, cookieOptions);
    return res.redirect('/login');
  }

  return req.session.destroy((err) => {
    res.clearCookie(cookieName, cookieOptions);
    if (err) {
      req.flash('error', 'No se pudo cerrar la sesión. Intenta de nuevo.');
    }
    return res.redirect('/login');
  });
}

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(ROLE_HOME[req.session.user.rol] || '/');
  }

  return res.render('auth/login', { title: 'Iniciar sesión' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });

    try {
      await regenerateSession(req);
      req.session.user = { ...data.usuario, token: data.accessToken };
      await saveSession(req);
    } catch (sessionErr) {
      console.error('Error al crear sesión web:', sessionErr);
      req.flash('error', 'No se pudo iniciar sesión. Intenta de nuevo.');
      return res.redirect('/login');
    }

    return res.redirect(ROLE_HOME[data.usuario.rol] || '/');
  } catch (err) {
    const raw = err.response?.data?.message || 'Credenciales incorrectas';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    return res.redirect('/login');
  }
});

router.get('/logout', destroySession);
router.get('/auth/logout', destroySession); // compatibilidad con vistas viejas

router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  return res.redirect(ROLE_HOME[req.session.user.rol] || '/login');
});

module.exports = router;