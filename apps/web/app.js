require('dotenv').config({ path: '../../.env' });

const express = require('express');
const session = require('express-session');
const flash   = require('connect-flash');
const path    = require('path');

const app = express();

// ─── View engine ───
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static files ───
app.use(express.static(path.join(__dirname, 'public')));

// ─── Body parsing ───
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Session ───
app.use(session({
  secret: process.env.JWT_SECRET || 'mero-web-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8 h
}));

// ─── Flash ───
app.use(flash());

// ─── Template helpers & globals ───
app.use((req, res, next) => {
  res.locals.user       = req.session.user || null;
  res.locals.flash      = req.flash();
  res.locals.currentUrl = req.path;

  // Slot efficiency → CSS modifier
  res.locals.slotClass = (eff) => {
    if (eff == null || eff === 0) return 'none';
    if (eff >= 90) return 'ok';
    if (eff >= 70) return 'warn';
    return 'fail';
  };

  // Efficiency value → CSS class
  res.locals.effClass = (eff) => {
    if (eff == null || eff === 0) return 'eff-value--none';
    if (eff >= 90) return 'eff-value--ok';
    if (eff >= 70) return 'eff-value--warn';
    return 'eff-value--fail';
  };

  // Format a number as efficiency string "92.4%"
  res.locals.fmtEff = (eff) =>
    eff != null ? `${Number(eff).toFixed(1)}%` : '—';

  // Format ISO date as "DD/MM/YYYY HH:MM"
  res.locals.fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  next();
});

// ─── Rutas ───
app.use('/',          require('./routes/auth'));
app.use('/encargado', require('./routes/encargado'));
app.use('/admin',     require('./routes/admin'));
app.use('/consultor', require('./routes/consultor'));

// ─── Errores ───
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'No encontrado' });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('errors/500', { title: 'Error interno' });
});

const PORT = process.env.WEB_PORT || 4000;
app.listen(PORT, () => {
  console.log(`MERO Web → http://localhost:${PORT}`);
});
