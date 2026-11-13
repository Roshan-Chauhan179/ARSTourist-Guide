import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'ars.db'));
const app = express();
// 3000 is frequently occupied by another local development server.  Using a
// project-specific default keeps this app from silently opening a different
// website when start.bat is used.
const PORT = Number(process.env.PORT || 3010);
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-this-secret';
// Booking dates are calendar dates, so use the server's local calendar day.
// UTC would incorrectly reject "today" for users east of UTC after midnight.
const todayIsoDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const isPastTravelDate = date => Boolean(date) && date < todayIsoDate();
// OpenAI secret keys begin with `sk-` (including project keys such as
// `sk-proj-...`). Treat any other value as unconfigured so it is never sent
// to the API or echoed back by a provider error.
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const HAS_OPENAI_API_KEY = /^sk-(?:proj-)?[A-Za-z0-9_-]{20,}$/.test(OPENAI_API_KEY);
const safeAiError = error => {
  const status = error?.status || error?.statusCode;
  return status ? `request failed (HTTP ${status})` : 'request failed';
};
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET === 'development-only-change-this-secret')) throw new Error('Set a strong JWT_SECRET before running in production.');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', loyalty_points INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT NOT NULL, rating INTEGER NOT NULL,
    message TEXT NOT NULL, photo_data TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS saved_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, destination TEXT NOT NULL,
    days INTEGER NOT NULL, travellers INTEGER NOT NULL, budget INTEGER NOT NULL, plan_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS plan_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(plan_id) REFERENCES saved_plans(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS traveller_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, full_name TEXT NOT NULL,
    traveller_type TEXT NOT NULL DEFAULT 'adult', date_of_birth TEXT, passport_number TEXT,
    nationality TEXT, relationship TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS travel_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, traveller_id INTEGER,
    document_type TEXT NOT NULL, document_number TEXT, expiry_date TEXT, status TEXT NOT NULL DEFAULT 'Saved',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(traveller_id) REFERENCES traveller_profiles(id)
  );
  CREATE TABLE IF NOT EXISTS tour_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, destination TEXT NOT NULL, days INTEGER NOT NULL,
    price INTEGER NOT NULL, inclusions_json TEXT NOT NULL, photo_url TEXT, seats_left INTEGER NOT NULL DEFAULT 20,
    active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, booking_code TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, package_id INTEGER,
    traveller_count INTEGER NOT NULL, total_amount INTEGER NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending',
    booking_status TEXT NOT NULL DEFAULT 'pending', payment_id TEXT, contact_phone TEXT, reward_points_used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(package_id) REFERENCES tour_packages(id)
  );
  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, media_url TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'photo',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS emergency_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS trip_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_name TEXT NOT NULL, rating INTEGER NOT NULL, message TEXT NOT NULL, photo_data TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS activity_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
  CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
  CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
  CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_saved_plans_user_id ON saved_plans(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_history_user_id ON activity_history(user_id, id DESC);
`);
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'loyalty_points')) db.exec('ALTER TABLE users ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0');
if (!db.prepare('PRAGMA table_info(feedback)').all().some(column => column.name === 'photo_data')) db.exec('ALTER TABLE feedback ADD COLUMN photo_data TEXT');
if (!db.prepare('PRAGMA table_info(bookings)').all().some(column => column.name === 'contact_phone')) db.exec('ALTER TABLE bookings ADD COLUMN contact_phone TEXT');
if (!db.prepare('PRAGMA table_info(bookings)').all().some(column => column.name === 'reward_points_used')) db.exec('ALTER TABLE bookings ADD COLUMN reward_points_used INTEGER NOT NULL DEFAULT 0');
if (!db.prepare('PRAGMA table_info(bookings)').all().some(column => column.name === 'booking_type')) db.exec("ALTER TABLE bookings ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'package'");
if (!db.prepare('PRAGMA table_info(bookings)').all().some(column => column.name === 'item_name')) db.exec('ALTER TABLE bookings ADD COLUMN item_name TEXT');
if (!db.prepare('PRAGMA table_info(bookings)').all().some(column => column.name === 'booking_details_json')) db.exec('ALTER TABLE bookings ADD COLUMN booking_details_json TEXT');
if (!db.prepare('SELECT COUNT(*) AS count FROM tour_packages').get().count) {
  const seed = db.prepare('INSERT INTO tour_packages (title, destination, days, price, inclusions_json, photo_url, seats_left) VALUES (?, ?, ?, ?, ?, ?, ?)');
  seed.run('Dubai City & Desert Escape', 'Dubai, UAE', 5, 74999, JSON.stringify(['4-star hotel', 'Daily breakfast', 'Airport transfers', 'Desert safari', 'Dubai city tour']), 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=85', 18);
  seed.run('Bali Beach & Culture', 'Bali, Indonesia', 6, 68999, JSON.stringify(['Beach resort', 'Daily breakfast', 'Airport transfers', 'Temple tour', 'Ubud day trip']), 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=85', 14);
  seed.run('Paris Highlights', 'Paris, France', 5, 119999, JSON.stringify(['Central hotel', 'Daily breakfast', 'Airport transfers', 'Seine cruise', 'City pass']), 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1000&q=85', 10);
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// Photos are submitted as base64 JSON by the reviews page. Keep a generous
// transport allowance while still protecting the server from unlimited bodies.
app.use(express.json({ limit: '100mb' }));
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=(self)');
  next();
});
const requestBuckets = new Map();
app.use('/api', (req, res, next) => {
  const allowedOrigins = new Set([`http://localhost:${PORT}`, process.env.APP_ORIGIN].filter(Boolean));
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  const isAuthRoute = req.path.startsWith('/auth/');
  const key = `${req.ip || 'unknown'}:${isAuthRoute ? 'auth' : 'api'}`; const now = Date.now(); const bucket = requestBuckets.get(key) || { started: now, count: 0 };
  if (now - bucket.started > 60_000) { bucket.started = now; bucket.count = 0; }
  bucket.count += 1; requestBuckets.set(key, bucket);
  const limit = isAuthRoute ? 10 : 100;
  if (bucket.count > limit) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  if (requestBuckets.size > 2_000) for (const [bucketKey, item] of requestBuckets) if (now - item.started > 60_000) requestBuckets.delete(bucketKey);
  next();
});
// Every HTML screen receives the same translator. This keeps a selected
// language active on live tools, hotels, packages, and account screens—not
// only on the home page where the language picker is displayed.
function sendTranslatedHtml(filePath, res, next) {
  fs.readFile(filePath, 'utf8', (error, html) => {
    if (error) return next ? next() : res.sendStatus(404);
    const translatedHtml = /<script\s+src=["']translate\.js["']/i.test(html)
      ? html
      : html.replace('</body>', '<script src="translate.js"></script></body>');
    const withActivityHistory = /<script\s+src=["']activity\.js["']/i.test(translatedHtml)
      ? translatedHtml
      : translatedHtml.replace('</body>', '<script src="activity.js"></script></body>');
    return res.type('html').send(withActivityHistory);
  });
}
app.use((req, res, next) => {
  if (req.method !== 'GET' || !/\.html?$/i.test(req.path)) return next();
  const relativePath = decodeURIComponent(req.path).replace(/^[/\\]+/, '');
  const filePath = path.resolve(__dirname, relativePath);
  if (!filePath.startsWith(`${__dirname}${path.sep}`)) return res.sendStatus(400);
  return sendTranslatedHtml(filePath, res, next);
});
app.use(express.static(__dirname));

function safeUser(user) { return { id: user.id, name: user.name, email: user.email, loyaltyPoints: user.loyalty_points || 0 }; }
function tokenFor(user) { return jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '7d' }); }
function readCookie(req, name) {
  return String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}
function sessionCookie(res, token) {
  res.cookie('ars_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
}
function authOptional(req, _res, next) {
  const value = readCookie(req, 'ars_session');
  if (value) { try { req.user = jwt.verify(value, JWT_SECRET); } catch { /* anonymous request */ } }
  next();
}
function authRequired(req, res, next) {
  authOptional(req, res, () => req.user ? next() : res.status(401).json({ error: 'Please log in first.' }));
}
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    const configuredEmail = cleanText(process.env.ADMIN_EMAIL, 180).toLowerCase();
    const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(req.user.id);
    if (!configuredEmail || user?.email !== configuredEmail || user.role !== 'admin') return res.status(403).json({ error: 'Admin access is not configured for this account. Set ADMIN_EMAIL in .env and restart the server.' });
    next();
  });
}
function cleanText(value, max = 120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function addHistory(userId, action, detail = '') {
  const safeAction = cleanText(action, 60); const safeDetail = cleanText(detail, 180);
  if (safeAction) db.prepare('INSERT INTO activity_history (user_id, action, detail) VALUES (?, ?, ?)').run(userId, safeAction, safeDetail || null);
}
function syncConfiguredAdmin() {
  const email = cleanText(process.env.ADMIN_EMAIL, 180).toLowerCase();
  if (email) db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
}
syncConfiguredAdmin();
function weatherCodeText(code) {
  if ([0].includes(code)) return ['☀️', 'Clear sky'];
  if ([1, 2].includes(code)) return ['🌤️', 'Partly cloudy'];
  if ([3].includes(code)) return ['☁️', 'Overcast'];
  if ([45, 48].includes(code)) return ['🌫️', 'Foggy'];
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['🌧️', 'Rainy'];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['❄️', 'Snowy'];
  return ['⛈️', 'Thunderstorms'];
}
async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
const cache = new Map();
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key); if (hit && Date.now() - hit.time < ttlMs) return hit.value;
  const value = await loader(); cache.set(key, { time: Date.now(), value }); return value;
}
async function geocode(destination) {
  // Some popular Indian tourist regions are not consistently indexed as a city
  // by the public geocoder. Resolve them to a nearby, well-known city first.
  const aliases = {
    goa: 'Panaji, Goa, India',
    kashmir: 'Srinagar, Jammu and Kashmir, India',
    'jammu & kashmir': 'Srinagar, Jammu and Kashmir, India',
    ladakh: 'Leh, Ladakh, India'
  };
  const q = encodeURIComponent(aliases[String(destination).trim().toLowerCase()] || destination);
  const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`);
  const json = await response.json();
  const place = json.results?.[0];
  if (!place) throw new Error('Destination not found. Try a city or region name.');
  return place;
}
let amadeusAccessToken = null;
async function getAmadeusToken() {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Live hotel offers are not configured. Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to .env.');
  if (amadeusAccessToken && amadeusAccessToken.expiresAt > Date.now() + 60_000) return amadeusAccessToken.value;
  const baseUrl = process.env.AMADEUS_ENVIRONMENT === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
  const response = await fetchWithTimeout(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString()
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Amadeus authentication failed. Check the server credentials.');
  amadeusAccessToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 900) * 1000 };
  return amadeusAccessToken.value;
}
async function amadeusGet(endpoint) {
  const token = await getAmadeusToken();
  const baseUrl = process.env.AMADEUS_ENVIRONMENT === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
  const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.[0]?.detail || 'Amadeus could not return live offers.');
  return data;
}
async function amadeusAirportCode(city) {
  const data = await amadeusGet(`/v1/reference-data/locations?subType=AIRPORT,CITY&keyword=${encodeURIComponent(city)}&page%5Blimit%5D=1`);
  const code = data.data?.[0]?.iataCode;
  if (!code) throw new Error(`No airport found for ${city}. Try a larger nearby city.`);
  return code;
}
function shareToken() { return crypto.randomBytes(24).toString('base64url'); }
function tokenHash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function publicAppUrl(req) { return process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`; }
async function sendNotification({ email, subject, text, smsText }) {
  const results = { email: 'not-configured', sms: 'not-configured' };
  if (process.env.BREVO_API_KEY && process.env.NOTIFICATION_FROM_EMAIL && email) {
    try {
      const response = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: { email: process.env.NOTIFICATION_FROM_EMAIL, name: 'ARS Tourist Guide' }, to: [{ email }], subject, textContent: text }) });
      results.email = response.ok ? 'sent' : 'failed';
    } catch { results.email = 'failed'; }
  }
  // SMS is optional and only sent when a phone number is collected by a future checkout/profile flow.
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && smsText?.to) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ From: process.env.TWILIO_FROM_NUMBER, To: smsText.to, Body: smsText.body }).toString() });
      results.sms = response.ok ? 'sent' : 'failed';
    } catch { results.sms = 'failed'; }
  }
  return results;
}
async function fetchOverpass(query) {
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ARS-Tourist-Guide/1.0' },
        body: `data=${encodeURIComponent(query)}`
      });
      if (!response.ok) throw new Error(`Transport data source returned ${response.status}`);
      return await response.json();
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Live place data is unavailable.');
}
function buildFreePlan(destination, days, travellers, budget) {
  const activities = ['city orientation and a local landmark', 'popular attractions and a local market', 'culture, museums or heritage sites', 'a scenic area and local food', 'free time for shopping and favourites'];
  const dailyPlan = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    morning: `Visit ${activities[index % activities.length]}`,
    afternoon: 'Have lunch at a well-reviewed local restaurant and explore nearby places',
    evening: 'Relax, check the next day’s route, and enjoy a safe walk in a busy area'
  }));
  const perPersonDaily = budget ? Math.max(1, Math.round(budget / travellers / days)) : 2500;
  return {
    title: destination,
    description: `A practical ${days}-day smart trip plan for ${travellers} traveller${travellers === 1 ? '' : 's'}, created without a paid AI API.`,
    places: ['Central landmark', 'Local market', 'Popular sightseeing area', 'Cultural attraction', 'Scenic viewpoint'],
    food: ['Local speciality', 'Popular street food', 'Traditional meal'],
    hotel: budget ? `Choose a stay within about ₹${Math.round(perPersonDaily * travellers * 0.45).toLocaleString()} per night for the group.` : 'Compare well-reviewed stays near the city centre before booking.',
    weather: 'Live weather is shown separately above. Carry comfortable footwear, water, ID, and weather-appropriate clothing.',
    checklist: ['Government ID', 'Phone charger / power bank', 'Comfortable walking shoes', 'Water bottle', 'Basic medicines', 'Weather-appropriate clothing'],
    dailyPlan,
    mode: 'free-offline'
  };
}

app.post('/api/auth/signup', async (req, res) => {
  const name = cleanText(req.body.name, 80); const email = cleanText(req.body.email, 180).toLowerCase(); const password = String(req.body.password || '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 8 characters.' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (name, email, password_hash, loyalty_points) VALUES (?, ?, ?, ?)').run(name, email, passwordHash, 100);
    syncConfiguredAdmin();
    const user = { id: result.lastInsertRowid, name, email, loyalty_points: 100 };
    sessionCookie(res, tokenFor(user));
    res.status(201).json({ user: safeUser(user) });
  } catch (error) { res.status(409).json({ error: 'An account with this email already exists.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const email = cleanText(req.body.email, 180).toLowerCase(); const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  sessionCookie(res, tokenFor(user));
  res.json({ user: safeUser(user) });
});
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('ars_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.status(204).end();
});
app.post('/api/auth/password-reset/request', async (req, res) => {
  const email = cleanText(req.body.email, 180).toLowerCase();
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  // Always return the same response so account existence is not exposed.
  if (user) {
    const token = shareToken(); const expiresAt = Date.now() + 30 * 60_000;
    db.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').run(user.id, Date.now());
    db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, tokenHash(token), expiresAt);
    const link = `${publicAppUrl(req)}/reset.html?token=${encodeURIComponent(token)}`;
    await sendNotification({ email: user.email, subject: 'Reset your ARS Tourist Guide password', text: `Use this link within 30 minutes to reset your password: ${link}` });
  }
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});
app.post('/api/auth/password-reset/confirm', async (req, res) => {
  const token = cleanText(req.body.token, 200); const password = String(req.body.password || '');
  if (!token || password.length < 8) return res.status(400).json({ error: 'Use a valid reset link and a password of at least 8 characters.' });
  const reset = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(tokenHash(token), Date.now());
  if (!reset) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(password, 12), reset.user_id);
  db.prepare("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?").run(reset.id);
  res.json({ message: 'Password reset successfully. You can now log in.' });
});
app.get('/api/auth/session', authOptional, (req, res) => {
  const user = req.user ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id) : null;
  res.json({ user: user ? safeUser(user) : null });
});
app.get('/api/loyalty', authRequired, (req, res) => { const user = db.prepare('SELECT loyalty_points FROM users WHERE id = ?').get(req.user.id); res.json({ points: user?.loyalty_points || 0, valueInr: user?.loyalty_points || 0, note: '1 point = ₹1. Up to 20% of a package can be redeemed.' }); });
app.get('/api/emergency-contacts', authRequired, (req, res) => res.json(db.prepare('SELECT id, name, phone FROM emergency_contacts WHERE user_id = ? ORDER BY id DESC').all(req.user.id)));
app.post('/api/emergency-contacts', authRequired, (req, res) => { const name = cleanText(req.body.name, 80); const phone = cleanText(req.body.phone, 20).replace(/[\s()-]/g, ''); if (!name || !/^\+?[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'Enter a contact name and valid phone number with country code.' }); const result = db.prepare('INSERT INTO emergency_contacts (user_id, name, phone) VALUES (?, ?, ?)').run(req.user.id, name, phone); res.status(201).json({ id: result.lastInsertRowid, name, phone }); });
app.delete('/api/emergency-contacts/:id', authRequired, (req, res) => { const result = db.prepare('DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id); result.changes ? res.status(204).end() : res.status(404).json({ error: 'Contact not found.' }); });
app.get('/api/account/travellers', authRequired, (req, res) => {
  res.json(db.prepare('SELECT id, full_name, traveller_type, date_of_birth, passport_number, nationality, relationship FROM traveller_profiles WHERE user_id = ? ORDER BY id DESC').all(req.user.id));
});
app.post('/api/account/travellers', authRequired, (req, res) => {
  const fullName = cleanText(req.body.fullName, 100);
  const travellerType = ['adult', 'child', 'infant'].includes(req.body.travellerType) ? req.body.travellerType : 'adult';
  const dateOfBirth = cleanText(req.body.dateOfBirth, 10); const passportNumber = cleanText(req.body.passportNumber, 30).toUpperCase();
  const nationality = cleanText(req.body.nationality, 60); const relationship = cleanText(req.body.relationship, 50);
  if (!fullName) return res.status(400).json({ error: 'Traveller name is required.' });
  const count = db.prepare('SELECT COUNT(*) AS count FROM traveller_profiles WHERE user_id = ?').get(req.user.id).count;
  if (count >= 5) return res.status(400).json({ error: 'A family or group can have up to 5 saved travellers.' });
  const result = db.prepare('INSERT INTO traveller_profiles (user_id, full_name, traveller_type, date_of_birth, passport_number, nationality, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.user.id, fullName, travellerType, dateOfBirth || null, passportNumber || null, nationality || null, relationship || null);
  res.status(201).json({ id: result.lastInsertRowid, fullName, travellerType, dateOfBirth, passportNumber, nationality, relationship });
});
app.delete('/api/account/travellers/:id', authRequired, (req, res) => {
  const result = db.prepare('DELETE FROM traveller_profiles WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Traveller not found.' });
  res.status(204).end();
});
app.get('/api/account/documents', authRequired, (req, res) => {
  res.json(db.prepare(`SELECT d.id, d.document_type, d.document_number, d.expiry_date, d.status, t.full_name AS traveller_name FROM travel_documents d LEFT JOIN traveller_profiles t ON t.id = d.traveller_id WHERE d.user_id = ? ORDER BY d.id DESC`).all(req.user.id));
});
app.post('/api/account/documents', authRequired, (req, res) => {
  const documentType = ['Passport', 'Visa', 'Insurance', 'Vaccine Certificate'].includes(req.body.documentType) ? req.body.documentType : '';
  const documentNumber = cleanText(req.body.documentNumber, 50); const expiryDate = cleanText(req.body.expiryDate, 10);
  const travellerId = Number(req.body.travellerId) || null;
  if (!documentType) return res.status(400).json({ error: 'Choose a document type.' });
  if (travellerId && !db.prepare('SELECT 1 FROM traveller_profiles WHERE id = ? AND user_id = ?').get(travellerId, req.user.id)) return res.status(400).json({ error: 'Invalid traveller.' });
  const result = db.prepare('INSERT INTO travel_documents (user_id, traveller_id, document_type, document_number, expiry_date) VALUES (?, ?, ?, ?, ?)').run(req.user.id, travellerId, documentType, documentNumber || null, expiryDate || null);
  res.status(201).json({ id: result.lastInsertRowid, documentType, documentNumber, expiryDate, status: 'Saved' });
});
app.delete('/api/account/documents/:id', authRequired, (req, res) => {
  const result = db.prepare('DELETE FROM travel_documents WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Document not found.' });
  res.status(204).end();
});
app.get('/api/account/history', authRequired, (req, res) => {
  res.json(db.prepare('SELECT id, action, detail, created_at FROM activity_history WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id));
});
app.post('/api/account/history', authRequired, (req, res) => {
  const action = cleanText(req.body.action, 60); const detail = cleanText(req.body.detail, 180);
  if (!action) return res.status(400).json({ error: 'History action is required.' });
  addHistory(req.user.id, action, detail);
  res.status(201).json({ message: 'Activity saved.' });
});
app.get('/api/weather', async (req, res) => {
  try {
    const destination = cleanText(req.query.destination, 100);
    const output = await cached(`weather:${destination.toLowerCase()}`, 10 * 60_000, async () => {
      const place = await geocode(destination);
      const response = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&daily=sunrise,weather_code,precipitation_probability_max,wind_speed_10m_max&timezone=auto`);
      if (!response.ok) throw new Error('Weather service is unavailable.');
      const data = await response.json(); const current = data.current; const [icon, condition] = weatherCodeText(current.weather_code);
      const rainChance = Number(data.daily?.precipitation_probability_max?.[0] || 0);
      const maximumWind = Math.round(Number(data.daily?.wind_speed_10m_max?.[0] || 0));
      const todayCode = Number(data.daily?.weather_code?.[0]);
      const alert = todayCode >= 95
        ? { level: 'warning', title: 'Thunderstorm alert', text: 'Avoid exposed outdoor areas and check local advisories before travelling.' }
        : rainChance >= 60 || [61, 63, 65, 80, 81, 82].includes(todayCode)
          ? { level: 'rain', title: 'Rain alert', text: `Rain chance is ${rainChance}%. Carry rain protection and allow extra travel time.` }
          : maximumWind >= 40
            ? { level: 'wind', title: 'Wind alert', text: `Winds may reach ${maximumWind} km/h. Secure loose items and check transport updates.` }
            : { level: 'clear', title: 'No major weather alert', text: 'Conditions look suitable for normal plans; check again before heading out.' };
      return { location: `${place.name}${place.country ? `, ${place.country}` : ''}`, icon, condition, temperature: Math.round(current.temperature_2m), humidity: current.relative_humidity_2m, wind: Math.round(current.wind_speed_10m), rain: current.precipitation, sunrise: data.daily?.sunrise?.[0] || null, alert };
    });
    res.json(output);
  } catch (error) { res.status(400).json({ error: error.message || 'Could not load weather.' }); }
});
app.get('/api/hotels/offers', async (req, res) => {
  try {
    const destination = cleanText(req.query.destination, 100);
    const checkInDate = cleanText(req.query.checkIn, 10);
    const checkOutDate = cleanText(req.query.checkOut, 10);
    const adults = Math.min(Math.max(Number(req.query.adults) || 1, 1), 9);
    if (!destination || !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate) || isPastTravelDate(checkInDate) || isPastTravelDate(checkOutDate) || checkOutDate <= checkInDate) return res.status(400).json({ error: 'Check-in and check-out dates must be today or later, with check-out after check-in.' });
    const output = await cached(`amadeus:${destination.toLowerCase()}:${checkInDate}:${checkOutDate}:${adults}`, 5 * 60_000, async () => {
      const place = await geocode(destination);
      const hotels = await amadeusGet(`/v1/reference-data/locations/hotels/by-geocode?latitude=${encodeURIComponent(place.latitude)}&longitude=${encodeURIComponent(place.longitude)}&radius=20&radiusUnit=KM&hotelSource=ALL`);
      const hotelIds = (hotels.data || []).slice(0, 20).map(hotel => hotel.hotelId).filter(Boolean);
      if (!hotelIds.length) return { location: place.name, items: [] };
      const offers = await amadeusGet(`/v3/shopping/hotel-offers?hotelIds=${encodeURIComponent(hotelIds.join(','))}&adults=${adults}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&currency=INR`);
      return {
        location: place.name,
        items: (offers.data || []).map(item => {
          const offer = item.offers?.[0];
          return offer ? { hotelId: item.hotel?.hotelId, name: item.hotel?.name || 'Hotel', rating: item.hotel?.rating || '', address: item.hotel?.address?.lines?.join(', ') || '', price: offer.price?.total, currency: offer.price?.currency || 'INR', room: offer.room?.typeEstimated?.category || 'Room', cancellation: offer.policies?.cancellations?.[0]?.description?.text || '' } : null;
        }).filter(Boolean)
      };
    });
    res.json(output);
  } catch (error) { res.status(503).json({ error: error.message || 'Live hotel offers are unavailable right now.' }); }
});
app.get('/api/flights/offers', async (req, res) => {
  try {
    const origin = cleanText(req.query.origin, 100); const destination = cleanText(req.query.destination, 100);
    const departureDate = cleanText(req.query.departureDate, 10); const adults = Math.min(Math.max(Number(req.query.adults) || 1, 1), 9);
    if (!origin || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) return res.status(400).json({ error: 'Enter origin, destination, and a valid departure date.' });
    if (isPastTravelDate(departureDate)) return res.status(400).json({ error: 'Departure date must be today or later.' });
    const output = await cached(`flights:${origin}:${destination}:${departureDate}:${adults}`, 5 * 60_000, async () => {
      const [originCode, destinationCode] = await Promise.all([amadeusAirportCode(origin), amadeusAirportCode(destination)]);
      const data = await amadeusGet(`/v2/shopping/flight-offers?originLocationCode=${encodeURIComponent(originCode)}&destinationLocationCode=${encodeURIComponent(destinationCode)}&departureDate=${departureDate}&adults=${adults}&currencyCode=INR&max=6`);
      return { originCode, destinationCode, items: (data.data || []).map(offer => { const segment = offer.itineraries?.[0]?.segments || []; const first = segment[0]; const last = segment.at(-1); return { id: offer.id, airline: first?.carrierCode || 'Airline', flight: segment.map(s => `${s.carrierCode || ''}${s.number || ''}`).join(' · '), departure: first?.departure?.at || '', arrival: last?.arrival?.at || '', duration: offer.itineraries?.[0]?.duration || '', stops: Math.max(0, segment.length - 1), price: offer.price?.grandTotal, currency: offer.price?.currency || 'INR' }; }) };
    });
    res.json(output);
  } catch (error) { res.status(503).json({ error: error.message || 'Live flight offers are unavailable right now.' }); }
});
app.get('/api/currency/convert', async (req, res) => {
  try {
    const from = cleanText(req.query.from, 3).toUpperCase(); const to = cleanText(req.query.to, 3).toUpperCase(); const amount = Math.max(Number(req.query.amount) || 0, 0);
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !amount) return res.status(400).json({ error: 'Enter valid currencies and amount.' });
    if (from === to) return res.json({ from, to, amount, converted: amount, rate: 1, source: 'same-currency' });
    const data = await cached(`fx:${from}:${to}`, 60 * 60_000, async () => { const response = await fetchWithTimeout(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`); if (!response.ok) throw new Error('Currency service is unavailable.'); return response.json(); });
    const rate = Number(data.rates?.[to]); if (data.result !== 'success' || !rate) throw new Error('Currency pair is not available.');
    const date = data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0, 10) : '';
    res.json({ from, to, amount, converted: amount * rate, rate, date, source: 'ExchangeRate-API' });
  } catch (error) { res.status(503).json({ error: error.message || 'Currency conversion is unavailable.' }); }
});
app.get('/api/places', async (req, res) => {
  try {
    const destination = cleanText(req.query.destination, 100); const place = await geocode(destination);
    const kind = ['hotel', 'transport', 'food', 'emergency'].includes(req.query.kind) ? req.query.kind : 'attraction';
    const query = kind === 'hotel'
      ? `[out:json][timeout:15];(nwr[\"tourism\"=\"hotel\"](around:12000,${place.latitude},${place.longitude});nwr[\"tourism\"=\"guest_house\"](around:12000,${place.latitude},${place.longitude}););out center 12;`
      : kind === 'transport'
        ? `[out:json][timeout:15];(nwr[\"railway\"=\"station\"](around:20000,${place.latitude},${place.longitude});nwr[\"amenity\"=\"bus_station\"](around:20000,${place.latitude},${place.longitude});nwr[\"highway\"=\"bus_stop\"](around:10000,${place.latitude},${place.longitude}););out center 12;`
        : kind === 'food'
          ? `[out:json][timeout:15];(nwr[\"amenity\"=\"restaurant\"](around:10000,${place.latitude},${place.longitude});nwr[\"amenity\"=\"cafe\"](around:10000,${place.latitude},${place.longitude});nwr[\"amenity\"=\"fast_food\"](around:8000,${place.latitude},${place.longitude}););out center 12;`
          : kind === 'emergency'
            ? `[out:json][timeout:15];(nwr[\"amenity\"=\"hospital\"](around:15000,${place.latitude},${place.longitude});nwr[\"amenity\"=\"clinic\"](around:12000,${place.latitude},${place.longitude});nwr[\"amenity\"=\"police\"](around:15000,${place.latitude},${place.longitude}););out center 12;`
      : `[out:json][timeout:15];(nwr[\"tourism\"=\"attraction\"](around:16000,${place.latitude},${place.longitude});nwr[\"tourism\"=\"museum\"](around:16000,${place.latitude},${place.longitude});nwr[\"historic\"](around:16000,${place.latitude},${place.longitude}););out center 12;`;
    const output = await cached(`places:${kind}:${destination.toLowerCase()}`, 15 * 60_000, async () => {
      const payload = await fetchOverpass(query);
      const seen = new Set(); const items = (payload.elements || []).map(item => ({ name: item.tags?.name, category: item.tags?.tourism || item.tags?.historic || item.tags?.railway || item.tags?.amenity || item.tags?.highway || kind, address: [item.tags?.['addr:street'], item.tags?.['addr:city']].filter(Boolean).join(', '), stars: item.tags?.stars || '', lat: item.lat || item.center?.lat, lon: item.lon || item.center?.lon })).filter(item => item.name && !seen.has(item.name) && seen.add(item.name)).slice(0, 6);
      return { location: place.name, items };
    });
    res.json(output);
  } catch (error) { res.status(502).json({ error: 'Could not load live place data right now.' }); }
});
app.get('/api/destination', async (req, res) => {
  try {
    const query = cleanText(req.query.query, 100);
    if (!query) return res.status(400).json({ error: 'Please enter a destination.' });
    const place = await geocode(query);
    res.json({ name: [place.name, place.admin1, place.country].filter((value, index, values) => value && values.indexOf(value) === index).join(', '), latitude: place.latitude, longitude: place.longitude, country: place.country || '' });
  } catch {
    res.status(404).json({ error: 'Destination not found.' });
  }
});
app.post('/api/feedback', authOptional, (req, res) => {
  const name = cleanText(req.body.name, 80); const message = cleanText(req.body.message, 1000); const rating = Number(req.body.rating); const photoData = typeof req.body.photoData === 'string' ? req.body.photoData : '';
  if (!name || !message || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Please provide name, a 1–5 rating, and feedback.' });
  if (photoData && !/^data:image\/(png|jpe?g|webp);base64,/i.test(photoData)) return res.status(400).json({ error: 'Upload a PNG, JPEG, or WebP photo.' });
  db.prepare('INSERT INTO feedback (user_id, name, rating, message, photo_data) VALUES (?, ?, ?, ?, ?)').run(req.user?.id || null, name, rating, message, photoData || null);
  res.status(201).json({ message: 'Thanks — your feedback has been submitted.' });
});
app.get('/api/feedback', (_req, res) => {
  const feedback = db.prepare('SELECT name, rating, message, photo_data, created_at FROM feedback ORDER BY id DESC LIMIT 8').all();
  res.json(feedback);
});
app.post('/api/reviews', authRequired, (req, res) => {
  const targetType = ['package', 'hotel', 'destination'].includes(req.body.targetType) ? req.body.targetType : ''; const targetName = cleanText(req.body.targetName, 100); const rating = Number(req.body.rating); const message = cleanText(req.body.message, 1000); const photoData = typeof req.body.photoData === 'string' ? req.body.photoData : '';
  if (!targetType || !targetName || !Number.isInteger(rating) || rating < 1 || rating > 5 || !message) return res.status(400).json({ error: 'Choose a target, rating, and review message.' });
  if (photoData && !/^data:image\/(png|jpe?g|webp);base64,/i.test(photoData)) return res.status(400).json({ error: 'Upload a PNG, JPEG, or WebP photo.' });
  const result = db.prepare('INSERT INTO trip_reviews (user_id, target_type, target_name, rating, message, photo_data) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, targetType, targetName, rating, message, photoData || null); res.status(201).json({ id: result.lastInsertRowid, message: 'Review published. Thanks for sharing your trip.' });
});
app.get('/api/reviews', (_req, res) => res.json(db.prepare('SELECT r.id, r.target_type, r.target_name, r.rating, r.message, r.photo_data, r.created_at, u.name FROM trip_reviews r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 24').all()));
app.post('/api/plans', authRequired, (req, res) => {
  const plan = req.body.plan; if (!plan || !cleanText(plan.title) || !Number.isInteger(plan.days)) return res.status(400).json({ error: 'Invalid plan.' });
  const result = db.prepare('INSERT INTO saved_plans (user_id, destination, days, travellers, budget, plan_json) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, cleanText(plan.title), plan.days, Number(plan.travellers) || 1, Number(plan.budget) || 0, JSON.stringify(plan));
  addHistory(req.user.id, 'Saved trip plan', cleanText(plan.title, 100));
  res.status(201).json({ id: result.lastInsertRowid });
});
app.get('/api/plans', authRequired, (req, res) => res.json(db.prepare('SELECT id, plan_json, created_at FROM saved_plans WHERE user_id = ? ORDER BY id DESC').all(req.user.id).map(row => ({ id: row.id, createdAt: row.created_at, ...JSON.parse(row.plan_json) }))));
app.delete('/api/plans/:id', authRequired, (req, res) => { const result = db.prepare('DELETE FROM saved_plans WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id); result.changes ? res.status(204).end() : res.status(404).json({ error: 'Plan not found.' }); });
app.post('/api/plans/:id/share', authRequired, (req, res) => {
  const planId = Number(req.params.id); const plan = db.prepare('SELECT id FROM saved_plans WHERE id = ? AND user_id = ?').get(planId, req.user.id);
  if (!plan) return res.status(404).json({ error: 'Saved plan not found.' });
  const token = shareToken(); db.prepare('INSERT INTO plan_shares (plan_id, token_hash, created_by) VALUES (?, ?, ?)').run(planId, tokenHash(token), req.user.id);
  res.status(201).json({ url: `${publicAppUrl(req)}/shared-plan.html?token=${encodeURIComponent(token)}` });
});
function sharedPlan(token) { return db.prepare('SELECT p.id, p.plan_json, p.created_at, u.name AS owner_name FROM plan_shares s JOIN saved_plans p ON p.id = s.plan_id JOIN users u ON u.id = p.user_id WHERE s.token_hash = ?').get(tokenHash(token)); }
app.get('/api/shared-plans/:token', (req, res) => {
  const item = sharedPlan(cleanText(req.params.token, 200)); if (!item) return res.status(404).json({ error: 'This collaboration link is invalid.' });
  res.json({ id: item.id, ownerName: item.owner_name, createdAt: item.created_at, plan: JSON.parse(item.plan_json) });
});
app.put('/api/shared-plans/:token', (req, res) => {
  const token = cleanText(req.params.token, 200); const item = sharedPlan(token); const plan = req.body.plan;
  if (!item) return res.status(404).json({ error: 'This collaboration link is invalid.' });
  if (!plan || !cleanText(plan.title) || !Number.isInteger(Number(plan.days))) return res.status(400).json({ error: 'Invalid trip plan.' });
  db.prepare('UPDATE saved_plans SET destination = ?, days = ?, travellers = ?, budget = ?, plan_json = ? WHERE id = ?').run(cleanText(plan.title), Number(plan.days), Number(plan.travellers) || 1, Number(plan.budget) || 0, JSON.stringify(plan), item.id);
  res.json({ message: 'Shared trip plan updated.' });
});
app.get('/api/packages', (_req, res) => res.json(db.prepare('SELECT * FROM tour_packages WHERE active = 1 ORDER BY id DESC').all().map(item => ({ ...item, inclusions: JSON.parse(item.inclusions_json) }))));
app.post('/api/bookings', authRequired, (req, res) => {
  const bookingType = req.body.bookingType === 'hotel' ? 'hotel' : 'package';
  const packageId = Number(req.body.packageId); const travellers = Math.min(Math.max(Number(req.body.travellers) || 1, 1), 9);
  const contactPhone = cleanText(req.body.contactPhone, 20).replace(/[\s()-]/g, '');
  if (contactPhone && !/^\+?[1-9]\d{7,14}$/.test(contactPhone)) return res.status(400).json({ error: 'Use a valid phone number with country code, e.g. +919876543210.' });
  if (bookingType === 'hotel') {
    const hotelName = cleanText(req.body.hotelName, 160); const destination = cleanText(req.body.destination, 100);
    const checkIn = cleanText(req.body.checkIn, 10); const checkOut = cleanText(req.body.checkOut, 10);
    const guests = Math.min(Math.max(Number(req.body.guests) || 1, 1), 9);
    if (!hotelName || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || isPastTravelDate(checkIn) || isPastTravelDate(checkOut) || checkOut <= checkIn) return res.status(400).json({ error: 'Hotel dates must be today or later, with check-out after check-in.' });
    const bookingCode = `ARS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const details = JSON.stringify({ destination, checkIn, checkOut, guests, quotedTotal: Math.max(0, Number(req.body.quotedTotal) || 0), currency: cleanText(req.body.currency, 8) || 'INR', room: cleanText(req.body.room, 100) });
    const result = db.prepare("INSERT INTO bookings (booking_code, user_id, package_id, traveller_count, total_amount, contact_phone, booking_type, item_name, booking_details_json, booking_status) VALUES (?, ?, NULL, ?, 0, ?, 'hotel', ?, ?, 'requested')").run(bookingCode, req.user.id, guests, contactPhone || null, hotelName, details);
    addHistory(req.user.id, 'Requested hotel booking', `${hotelName} · ${destination}`);
    return res.status(201).json({ id: result.lastInsertRowid, bookingCode, paymentStatus: 'not-required', bookingStatus: 'requested', message: 'Hotel reservation request received. Our team will confirm availability and payment details.' });
  }
  const item = db.prepare('SELECT * FROM tour_packages WHERE id = ? AND active = 1').get(packageId);
  if (!item || item.seats_left < travellers) return res.status(400).json({ error: 'This package is unavailable for the selected travellers.' });
  const requestedPoints = Math.max(0, Math.floor(Number(req.body.redeemPoints) || 0)); const userPoints = db.prepare('SELECT loyalty_points FROM users WHERE id = ?').get(req.user.id)?.loyalty_points || 0; const grossAmount = item.price * travellers; const redeemPoints = Math.min(requestedPoints, userPoints, Math.floor(grossAmount * 0.2));
  const bookingCode = `ARS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const result = db.prepare('INSERT INTO bookings (booking_code, user_id, package_id, traveller_count, total_amount, contact_phone, reward_points_used) VALUES (?, ?, ?, ?, ?, ?, ?)').run(bookingCode, req.user.id, item.id, travellers, grossAmount - redeemPoints, contactPhone || null, redeemPoints);
  addHistory(req.user.id, 'Selected tour package', item.title);
  res.status(201).json({ id: result.lastInsertRowid, bookingCode, total: grossAmount - redeemPoints, redeemedPoints: redeemPoints, paymentStatus: 'pending' });
});
app.get('/api/bookings/me', authRequired, (req, res) => res.json(db.prepare(`SELECT b.*, COALESCE(b.item_name, p.title) AS title, p.destination, p.days FROM bookings b LEFT JOIN tour_packages p ON p.id = b.package_id WHERE b.user_id = ? ORDER BY b.id DESC`).all(req.user.id)));
app.get('/api/payments/config', (_req, res) => res.json({ enabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), keyId: process.env.RAZORPAY_KEY_ID || null }));
app.post('/api/payments/order', authRequired, async (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ error: 'Razorpay is not configured yet.' });
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(Number(req.body.bookingId), req.user.id);
  if (!booking || booking.payment_status === 'paid') return res.status(400).json({ error: 'This booking cannot be paid.' });
  try {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: booking.total_amount * 100, currency: 'INR', receipt: booking.booking_code, notes: { bookingId: String(booking.id) } }) });
    const order = await response.json(); if (!response.ok) throw new Error(order.error?.description || 'Razorpay order creation failed.');
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, bookingCode: booking.booking_code });
  } catch (error) { res.status(502).json({ error: error.message }); }
});
app.post('/api/payments/verify', authRequired, (req, res) => {
  const orderId = cleanText(req.body.razorpay_order_id, 100); const paymentId = cleanText(req.body.razorpay_payment_id, 100); const signature = cleanText(req.body.razorpay_signature, 200);
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  const supplied = Buffer.from(signature); const expectedBuffer = Buffer.from(expected);
  if (!process.env.RAZORPAY_KEY_SECRET || supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, supplied)) return res.status(400).json({ error: 'Payment signature verification failed.' });
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(Number(req.body.bookingId), req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  db.prepare("UPDATE bookings SET payment_status = 'paid', booking_status = 'confirmed', payment_id = ? WHERE id = ?").run(paymentId, booking.id);
  addHistory(req.user.id, 'Completed payment', booking.booking_code);
  db.prepare('UPDATE tour_packages SET seats_left = MAX(0, seats_left - ?) WHERE id = ?').run(booking.traveller_count, booking.package_id);
  const earnedPoints = Math.floor(booking.total_amount / 100); db.prepare('UPDATE users SET loyalty_points = MAX(0, loyalty_points - ?) + ? WHERE id = ?').run(booking.reward_points_used || 0, earnedPoints, booking.user_id);
  const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(booking.user_id);
  const item = db.prepare('SELECT title, destination FROM tour_packages WHERE id = ?').get(booking.package_id);
  sendNotification({ email: user?.email, subject: `Booking confirmed: ${booking.booking_code}`, text: `Hello ${user?.name || 'Traveller'}, your payment was verified. Booking code: ${booking.booking_code}. Package: ${item?.title || 'Travel package'} (${item?.destination || ''}). Amount paid: INR ${booking.total_amount}. Keep this email as your confirmation.`, smsText: booking.contact_phone ? { to: booking.contact_phone, body: `ARS booking confirmed: ${booking.booking_code}. ${item?.title || 'Travel package'} paid. Check your email for details.` } : null }).catch(() => {});
  res.json({ message: 'Payment verified and booking confirmed. A confirmation email will be sent if notifications are configured.' });
});
app.get('/api/gallery', (_req, res) => res.json(db.prepare('SELECT * FROM gallery_items ORDER BY id DESC').all()));
app.get('/api/admin/summary', adminRequired, (_req, res) => res.json({ users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count, packages: db.prepare('SELECT COUNT(*) AS count FROM tour_packages').get().count, bookings: db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count, paid: db.prepare("SELECT COUNT(*) AS count FROM bookings WHERE payment_status = 'paid'").get().count }));
app.get('/api/admin/users', adminRequired, (_req, res) => res.json(db.prepare('SELECT id, name, email, created_at FROM users ORDER BY id DESC').all()));
app.get('/api/admin/bookings', adminRequired, (_req, res) => res.json(db.prepare(`SELECT b.*, u.name AS user_name, u.email, COALESCE(b.item_name, p.title) AS title FROM bookings b JOIN users u ON u.id = b.user_id LEFT JOIN tour_packages p ON p.id = b.package_id ORDER BY b.id DESC`).all()));
app.get('/api/admin/packages', adminRequired, (_req, res) => res.json(db.prepare('SELECT * FROM tour_packages ORDER BY id DESC').all().map(item => ({ ...item, inclusions: JSON.parse(item.inclusions_json) }))));
app.post('/api/admin/packages', adminRequired, (req, res) => {
  const title = cleanText(req.body.title, 120); const destination = cleanText(req.body.destination, 100); const days = Math.min(Math.max(Number(req.body.days), 1), 30); const price = Math.max(Number(req.body.price), 0); const seats = Math.min(Math.max(Number(req.body.seats) || 1, 1), 999); const photoUrl = cleanText(req.body.photoUrl, 1000); const inclusions = Array.isArray(req.body.inclusions) ? req.body.inclusions.map(value => cleanText(value, 80)).filter(Boolean).slice(0, 10) : [];
  if (!title || !destination || !price || !inclusions.length) return res.status(400).json({ error: 'Add title, destination, price, and at least one inclusion.' });
  const result = db.prepare('INSERT INTO tour_packages (title, destination, days, price, inclusions_json, photo_url, seats_left) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, destination, days, price, JSON.stringify(inclusions), photoUrl || null, seats); res.status(201).json({ id: result.lastInsertRowid });
});
app.patch('/api/admin/packages/:id', adminRequired, (req, res) => { const price = Math.max(Number(req.body.price), 0); const seats = Math.min(Math.max(Number(req.body.seats), 0), 999); const active = req.body.active === false ? 0 : 1; const result = db.prepare('UPDATE tour_packages SET price = ?, seats_left = ?, active = ? WHERE id = ?').run(price, seats, active, Number(req.params.id)); result.changes ? res.json({ message: 'Package updated.' }) : res.status(404).json({ error: 'Package not found.' }); });
app.delete('/api/admin/packages/:id', adminRequired, (req, res) => { const result = db.prepare('DELETE FROM tour_packages WHERE id = ?').run(Number(req.params.id)); result.changes ? res.status(204).end() : res.status(404).json({ error: 'Package not found.' }); });
app.post('/api/admin/gallery', adminRequired, (req, res) => { const title = cleanText(req.body.title, 100); const mediaUrl = cleanText(req.body.mediaUrl, 1000); const mediaType = req.body.mediaType === 'video' ? 'video' : 'photo'; if (!title || !/^https?:\/\//i.test(mediaUrl)) return res.status(400).json({ error: 'Add a title and a valid public media URL.' }); const result = db.prepare('INSERT INTO gallery_items (title, media_url, media_type) VALUES (?, ?, ?)').run(title, mediaUrl, mediaType); res.status(201).json({ id: result.lastInsertRowid }); });
app.delete('/api/admin/gallery/:id', adminRequired, (req, res) => { const result = db.prepare('DELETE FROM gallery_items WHERE id = ?').run(Number(req.params.id)); result.changes ? res.status(204).end() : res.status(404).json({ error: 'Gallery item not found.' }); });
function validatePlan(plan, fallback) {
  if (!plan || typeof plan !== 'object') return fallback;
  const text = value => typeof value === 'string' && value.trim() ? cleanText(value, 700) : null;
  const list = (value, maximum) => Array.isArray(value) ? value.map(item => text(item)).filter(Boolean).slice(0, maximum) : [];
  const dailyPlan = Array.isArray(plan.dailyPlan) ? plan.dailyPlan.slice(0, 30).map((day, index) => ({ day: Number(day?.day) || index + 1, morning: text(day?.morning), afternoon: text(day?.afternoon), evening: text(day?.evening) })).filter(day => day.morning && day.afternoon && day.evening) : [];
  return text(plan.title) && text(plan.description) && text(plan.hotel) && text(plan.weather) && list(plan.places, 6).length && list(plan.food, 5).length && list(plan.checklist, 6).length && dailyPlan.length ? { title: text(plan.title), description: text(plan.description), places: list(plan.places, 6), food: list(plan.food, 5), hotel: text(plan.hotel), weather: text(plan.weather), checklist: list(plan.checklist, 6), dailyPlan, mode: 'ai' } : fallback;
}
app.post('/api/ai/plan', async (req, res) => {
  const destination = cleanText(req.body.destination, 100); const days = Math.min(Math.max(Number(req.body.days) || 3, 1), 30); const travellers = Math.min(Math.max(Number(req.body.travellers) || 1, 1), 30); const budget = Math.max(Number(req.body.budget) || 0, 0);
  if (!destination) return res.status(400).json({ error: 'Destination is required.' });
  const startDate = cleanText(req.body.startDate, 20); const endDate = cleanText(req.body.endDate, 20);
  if (isPastTravelDate(startDate) || isPastTravelDate(endDate) || (startDate && endDate && endDate < startDate)) return res.status(400).json({ error: 'Trip dates must be today or later, with the end date after the start date.' });
  const fallback = buildFreePlan(destination, days, travellers, budget);
  const preferences = { startDate, endDate, startCity: cleanText(req.body.startCity, 100), viaCities: cleanText(req.body.viaCities, 250), interests: cleanText(req.body.interests, 250), transportType: cleanText(req.body.transportType, 30), hotelClass: cleanText(req.body.hotelClass, 30) };
  if (preferences.viaCities) fallback.description += ` Includes stop cities: ${preferences.viaCities}.`;
  if (!HAS_OPENAI_API_KEY) return res.json(fallback);
  try {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetchWithTimeout('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', input: `Create a concise, practical travel plan for ${destination}, India or nearest matching region. ${days} days, ${travellers} travellers, target total budget INR ${budget || 'not specified'}. Preferences: ${JSON.stringify(preferences)}. Return JSON only with keys: title, description, places (array max 6), food (array max 5), hotel (string), weather (string), checklist (array max 6), dailyPlan (array of {day, morning, afternoon, evening}). Do not invent real-time facts; phrase weather as packing advice.`, text: { format: { type: 'json_object' } } }) }, 20_000);
        const json = await response.json(); if (!response.ok) throw new Error(json.error?.message || `AI request failed (${response.status})`);
        const text = json.output_text || json.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text;
        const plan = validatePlan(JSON.parse(text), null); if (!plan) throw new Error('AI returned an incomplete plan.');
        return res.json(plan);
      } catch (error) { lastError = error; if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    console.error('AI plan failed; using built-in itinerary:', safeAiError(lastError)); return res.json({ ...fallback, mode: 'free-fallback', notice: 'AI service was unavailable, so a practical built-in itinerary was created.' });
  } catch (error) { console.error('Plan request failed; using built-in itinerary:', safeAiError(error)); return res.json({ ...fallback, mode: 'free-fallback', notice: 'A practical built-in itinerary was created.' }); }
});
function builtInChatReply(message, destination) {
  const question = message.toLowerCase();
  const place = destination || 'your destination';
  if (/pack|packing|luggage|what.*bring/.test(question)) {
    return `For a 3-day ${place} trip, pack: 3 light outfits, one comfortable walking outfit, sleepwear, a light jacket or rain layer, comfortable shoes/sandals, sunscreen, sunglasses, reusable water bottle, toiletries, charger/power bank, ID, tickets, medicines, and a small day bag. Check the Live Weather card just before leaving, then add an umbrella or warmer layer if needed.`;
  }
  if (/3.?day|three.?day|itinerary|plan/.test(question)) {
    return `Here is a flexible 3-day ${place} plan: Day 1—arrive, check in, and explore a nearby landmark or market. Day 2—start early with the main attraction, take a local-food break, then keep the evening for a relaxed walk or cultural activity. Day 3—visit one quieter spot, shop for souvenirs, and leave enough time for transport. Use the Trip Planner above for dates, budget, and a fuller plan.`;
  }
  if (/budget|cheap|affordable|stay|hotel/.test(question)) {
    return `For a budget stay in ${place}, choose a well-reviewed place close to public transport, compare the total price including taxes, and check the cancellation policy, check-in time, and recent guest reviews. Open Hotels to compare currently available options for your dates.`;
  }
  if (/weather|mausam|rain|temperature/.test(question)) {
    return `For ${place}, please use the Live Weather card before you travel—it shows the latest conditions. As a safe default, carry a light layer, sun protection, and a compact rain cover.`;
  }
  return `I can help you plan ${place}. Ask about a packing list, a 3-day itinerary, budget stays, weather preparation, transport, or local food. For live availability and current conditions, use the matching cards on this page.`;
}
app.post('/api/ai/chat', async (req, res) => {
  const message = cleanText(req.body.message, 1000); const destination = cleanText(req.body.destination, 100);
  if (!message) return res.status(400).json({ error: 'Please type a question.' });
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-8).map(item => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: cleanText(item?.content, 1000) })).filter(item => item.content) : [];
  const fallback = builtInChatReply(message, destination);
  if (!HAS_OPENAI_API_KEY) {
    if (destination && /weather|mausam|rain|temperature|temperature/i.test(message)) {
      try {
        const place = await geocode(destination); const response = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&timezone=auto`); const data = await response.json(); const [icon, condition] = weatherCodeText(data.current.weather_code);
        return res.json({ answer: `${icon} ${place.name}: ${condition}, ${Math.round(data.current.temperature_2m)}°C. Wind ${Math.round(data.current.wind_speed_10m)} km/h, rain ${data.current.precipitation} mm. Check the Live Weather card again before outdoor plans.`, mode: 'basic' });
      } catch { /* Continue with the basic assistant response. */ }
    }
    return res.json({ answer: fallback, mode: 'basic' });
  }
  try {
    const response = await fetchWithTimeout('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', store: false, instructions: `You are ARS Tourist Guide, a concise and friendly travel assistant. Reply in the user's language. Destination context: ${destination || 'not selected'}. Give practical travel help. Do not claim real-time prices, availability, hours, weather, or safety facts; direct the visitor to the live cards for those details. Keep each answer under 120 words.`, input: [...history, { role: 'user', content: message }] }) }, 20_000);
    const json = await response.json(); if (!response.ok) throw new Error(json.error?.message || 'AI chat request failed');
    const answer = cleanText(json.output_text || json.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text, 1500);
    if (!answer) throw new Error('AI returned an empty reply.');
    res.json({ answer, mode: 'ai' });
  } catch (error) { console.error('AI chat failed; using basic reply:', safeAiError(error)); res.json({ answer: fallback, mode: 'basic' }); }
});
app.get('*splat', (_req, res) => sendTranslatedHtml(path.join(__dirname, 'index.HTML'), res));
app.listen(PORT, () => console.log(`ARS Tourist Guide is running on http://localhost:${PORT}`));
