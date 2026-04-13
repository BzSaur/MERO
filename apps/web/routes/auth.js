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

function resolveLoginError(err) {
  const status = err.response?.status;

  if (status === 401) {
    const raw = err.response?.data?.message || 'Credenciales incorrectas';
    return Array.isArray(raw) ? raw.join(', ') : raw;
  }

  if (status) {
    const raw = err.response?.data?.message || `Error de autenticación (HTTP ${status})`;
    return Array.isArray(raw) ? raw.join(', ') : raw;
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return 'No se pudo conectar con el API de autenticación.';
  }

  return 'No se pudo iniciar sesión. Intenta de nuevo.';
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
    console.error('Error login web->api:', {
      code: err.code,
      status: err.response?.status,
      data: err.response?.data,
    });
    req.flash('error', resolveLoginError(err));
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
