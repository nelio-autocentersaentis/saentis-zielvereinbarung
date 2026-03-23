// ═══════════════════════════════════════════════
// AUTOCENTER SÄNTIS – Firmenportal
// Node.js + MongoDB Atlas
// ═══════════════════════════════════════════════
const express      = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI    = process.env.MONGO_URI || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'saentis-portal-secret-2026';
const DB_NAME      = 'saentisportal';

let db = null;

// ── DB CONNECT ──
async function connectDB() {
  if (!MONGO_URI) { console.log('⚠  Kein MONGO_URI – In-Memory Modus'); return; }
  try {
    const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(DB_NAME);
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
    console.log('✓ MongoDB verbunden');
    await seedData();
  } catch(e) {
    console.error('✗ MongoDB Fehler:', e.message);
  }
}

// ── SEED: Standard-Daten beim ersten Start ──
async function seedData() {
  const userCount = await db.collection('users').countDocuments();
  if (userCount > 0) return;
  console.log('→ Erstelle Standard-Benutzer und Apps...');

  const adminPw = hashPw('Admin@Saentis2026');
  await db.collection('users').insertMany([
    { username: 'admin', name: 'Administrator', password: adminPw, role: 'admin', active: true, createdAt: new Date() },
    { username: 'abdullah', name: 'Abdullah Topbas', password: hashPw('Porsche@911'), role: 'user', active: true, createdAt: new Date() },
    { username: 'erol', name: 'Erol Adrovic', password: hashPw('Lamborghini@123'), role: 'user', active: true, createdAt: new Date() },
    { username: 'vakant', name: 'Vakant (VB)', password: hashPw('Skoda@123'), role: 'user', active: true, createdAt: new Date() },
  ]);

  await db.collection('apps').insertMany([
    {
      appId: 'zielvereinbarung',
      name: 'Zielvereinbarung 2026',
      description: 'Verkaufsziele, KPI-Tracking und Bonus-Berechnung',
      icon: '🎯',
      color: '#FF6E40',
      url: '/apps/zielvereinbarung/',
      active: true,
      createdAt: new Date()
    }
  ]);

  // Alle Benutzer zur Zielvereinbarung berechtigen
  const users = await db.collection('users').find({}).toArray();
  const app1  = await db.collection('apps').findOne({ appId: 'zielvereinbarung' });
  const perms  = users.map(u => ({
    userId: u._id.toString(),
    appId: app1._id.toString(),
    grantedAt: new Date()
  }));
  await db.collection('permissions').insertMany(perms);
  console.log('✓ Standard-Daten erstellt');
}

// ── HELPERS ──
function hashPw(pw) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(pw).digest('hex');
}
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── In-Memory Fallback ──
const mem = { users: [], apps: [], sessions: [], permissions: [], data: {} };
function initMem() {
  const adminPw = hashPw('Admin@Saentis2026');
  mem.users = [
    { _id:'u1', username:'admin', name:'Administrator', password:adminPw, role:'admin', active:true },
    { _id:'u2', username:'abdullah', name:'Abdullah Topbas', password:hashPw('Porsche@911'), role:'user', active:true },
    { _id:'u3', username:'erol', name:'Erol Adrovic', password:hashPw('Lamborghini@123'), role:'user', active:true },
    { _id:'u4', username:'vakant', name:'Vakant (VB)', password:hashPw('Skoda@123'), role:'user', active:true },
  ];
  mem.apps = [{ _id:'a1', appId:'zielvereinbarung', name:'Zielvereinbarung 2026', description:'Verkaufsziele, KPI-Tracking und Bonus-Berechnung', icon:'🎯', color:'#FF6E40', url:'/apps/zielvereinbarung/', active:true }];
  mem.permissions = mem.users.map(u => ({ userId:u._id, appId:'a1' }));
}
initMem();

// ── DB ABSTRACTION ──
const DB = {
  async findUser(query) {
    if (db) return db.collection('users').findOne(query);
    return mem.users.find(u => Object.keys(query).every(k => u[k] === query[k])) || null;
  },
  async findUserById(id) {
    if (db) return db.collection('users').findOne({ _id: new ObjectId(id) });
    return mem.users.find(u => u._id === id) || null;
  },
  async getUsers() {
    if (db) return db.collection('users').find({}).toArray();
    return mem.users;
  },
  async createUser(data) {
    if (db) { const r = await db.collection('users').insertOne({...data, createdAt: new Date()}); return r.insertedId.toString(); }
    const u = {...data, _id: 'u'+Date.now()}; mem.users.push(u); return u._id;
  },
  async updateUser(id, data) {
    if (db) return db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: data });
    const u = mem.users.find(u => u._id === id); if(u) Object.assign(u, data);
  },
  async deleteUser(id) {
    if (db) {
      await db.collection('users').deleteOne({ _id: new ObjectId(id) });
      await db.collection('sessions').deleteMany({ userId: id });
      await db.collection('permissions').deleteMany({ userId: id });
    } else {
      mem.users = mem.users.filter(u => u._id !== id);
      mem.sessions = mem.sessions.filter(s => s.userId !== id);
      mem.permissions = mem.permissions.filter(p => p.userId !== id);
    }
  },
  async getApps() {
    if (db) return db.collection('apps').find({}).toArray();
    return mem.apps;
  },
  async getAppById(id) {
    if (db) return db.collection('apps').findOne({ _id: new ObjectId(id) });
    return mem.apps.find(a => a._id === id) || null;
  },
  async createApp(data) {
    if (db) { const r = await db.collection('apps').insertOne({...data, createdAt: new Date()}); return r.insertedId.toString(); }
    const a = {...data, _id: 'a'+Date.now()}; mem.apps.push(a); return a._id;
  },
  async updateApp(id, data) {
    if (db) return db.collection('apps').updateOne({ _id: new ObjectId(id) }, { $set: data });
    const a = mem.apps.find(a => a._id === id); if(a) Object.assign(a, data);
  },
  async deleteApp(id) {
    if (db) { await db.collection('apps').deleteOne({ _id: new ObjectId(id) }); await db.collection('permissions').deleteMany({ appId: id }); }
    else { mem.apps = mem.apps.filter(a => a._id !== id); mem.permissions = mem.permissions.filter(p => p.appId !== id); }
  },
  async getPermissions(userId) {
    if (db) return db.collection('permissions').find({ userId }).toArray();
    return mem.permissions.filter(p => p.userId === userId);
  },
  async getUsersForApp(appId) {
    if (db) return db.collection('permissions').find({ appId }).toArray();
    return mem.permissions.filter(p => p.appId === appId);
  },
  async getAllPermissions() {
    if (db) return db.collection('permissions').find({}).toArray();
    return mem.permissions;
  },
  async setPermissions(userId, appIds) {
    if (db) {
      await db.collection('permissions').deleteMany({ userId });
      if (appIds.length > 0) {
        await db.collection('permissions').insertMany(appIds.map(appId => ({ userId, appId, grantedAt: new Date() })));
      }
    } else {
      mem.permissions = mem.permissions.filter(p => p.userId !== userId);
      appIds.forEach(appId => mem.permissions.push({ userId, appId }));
    }
  },
  async createSession(userId, username, role) {
    const token = genToken();
    if (db) await db.collection('sessions').insertOne({ token, userId, username, role, createdAt: new Date() });
    else mem.sessions.push({ token, userId, username, role, createdAt: new Date() });
    return token;
  },
  async getSession(token) {
    if (db) return db.collection('sessions').findOne({ token });
    return mem.sessions.find(s => s.token === token) || null;
  },
  async deleteSession(token) {
    if (db) return db.collection('sessions').deleteOne({ token });
    mem.sessions = mem.sessions.filter(s => s.token !== token);
  },
  async getData(key) {
    if (db) { const d = await db.collection('appdata').findOne({ _id: key }); return d ? d.value : null; }
    return mem.data[key] || null;
  },
  async setData(key, value) {
    if (db) await db.collection('appdata').replaceOne({ _id: key }, { _id: key, value, updatedAt: new Date() }, { upsert: true });
    else mem.data[key] = value;
  }
};

// ── MIDDLEWARE ──
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/apps', express.static(path.join(__dirname, 'public', 'apps')));

async function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  const session = await DB.getSession(token);
  if (!session) return res.status(401).json({ error: 'Session abgelaufen' });
  req.session = session;
  next();
}
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Kein Zugriff' });
    next();
  });
}
async function requireAppAccess(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.session.role === 'admin') return next();
    const { appId } = req.params;
    const app = await DB.getApps().then ? await DB.getApps() : mem.apps;
    const appDoc = (Array.isArray(app) ? app : []).find(a => a.appId === appId || a._id?.toString() === appId);
    if (!appDoc) return res.status(404).json({ error: 'App nicht gefunden' });
    const perms = await DB.getPermissions(req.session.userId);
    const hasAccess = perms.some(p => p.appId === appDoc._id?.toString() || p.appId === appDoc._id);
    if (!hasAccess) return res.status(403).json({ error: 'Kein Zugriff auf diese App' });
    next();
  });
}

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
  const user = await DB.findUser({ username: username.toLowerCase().trim() });
  if (!user || !user.active) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  if (user.password !== hashPw(password)) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  const token = await DB.createSession(user._id.toString(), user.username, user.role);
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
  res.json({ ok: true, name: user.name, role: user.role });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.session;
  if (token) await DB.deleteSession(token);
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.session;
  if (!token) return res.json(null);
  const session = await DB.getSession(token);
  if (!session) return res.json(null);
  const user = await DB.findUser({ username: session.username });
  if (!user) return res.json(null);
  res.json({ userId: session.userId, username: session.username, name: user.name, role: session.role });
});

// ══════════════════════════════════════════
// PORTAL ROUTES (authenticated)
// ══════════════════════════════════════════
app.get('/api/portal/apps', requireAuth, async (req, res) => {
  const allApps = await DB.getApps();
  if (req.session.role === 'admin') return res.json(allApps.filter(a => a.active));
  const perms = await DB.getPermissions(req.session.userId);
  const permAppIds = perms.map(p => p.appId);
  const myApps = allApps.filter(a => a.active && permAppIds.includes(a._id?.toString() || a._id));
  res.json(myApps);
});

// ══════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════

// USERS
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await DB.getUsers();
  const allPerms = await DB.getAllPermissions();
  const result = users.map(u => {
    const { password, ...safe } = u;
    safe._id = u._id?.toString() || u._id;
    safe.appIds = allPerms.filter(p => p.userId === safe._id).map(p => p.appId);
    return safe;
  });
  res.json(result);
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { username, name, password, role } = req.body;
  if (!username || !name || !password) return res.status(400).json({ error: 'Alle Felder erforderlich' });
  const existing = await DB.findUser({ username: username.toLowerCase().trim() });
  if (existing) return res.status(400).json({ error: 'Benutzername vergeben' });
  const id = await DB.createUser({ username: username.toLowerCase().trim(), name, password: hashPw(password), role: role || 'user', active: true });
  res.json({ ok: true, id });
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { name, password, role, active } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (role !== undefined) update.role = role;
  if (active !== undefined) update.active = active;
  if (password) update.password = hashPw(password);
  await DB.updateUser(req.params.id, update);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.userId) return res.status(400).json({ error: 'Eigener Account kann nicht gelöscht werden' });
  await DB.deleteUser(req.params.id);
  res.json({ ok: true });
});

// APPS
app.get('/api/admin/apps', requireAdmin, async (req, res) => {
  const apps = await DB.getApps();
  res.json(apps.map(a => ({ ...a, _id: a._id?.toString() || a._id })));
});

app.post('/api/admin/apps', requireAdmin, async (req, res) => {
  const { appId, name, description, icon, color, url } = req.body;
  if (!appId || !name || !url) return res.status(400).json({ error: 'appId, Name und URL erforderlich' });
  const id = await DB.createApp({ appId, name, description: description || '', icon: icon || '📱', color: color || '#FF6E40', url, active: true });
  res.json({ ok: true, id });
});

app.put('/api/admin/apps/:id', requireAdmin, async (req, res) => {
  const { name, description, icon, color, url, active } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (icon !== undefined) update.icon = icon;
  if (color !== undefined) update.color = color;
  if (url !== undefined) update.url = url;
  if (active !== undefined) update.active = active;
  await DB.updateApp(req.params.id, update);
  res.json({ ok: true });
});

app.delete('/api/admin/apps/:id', requireAdmin, async (req, res) => {
  await DB.deleteApp(req.params.id);
  res.json({ ok: true });
});

// PERMISSIONS
app.put('/api/admin/permissions/:userId', requireAdmin, async (req, res) => {
  const { appIds } = req.body;
  await DB.setPermissions(req.params.userId, appIds || []);
  res.json({ ok: true });
});

// APP DATA (für Zielvereinbarung etc.)
app.get('/api/data/:key', requireAuth, async (req, res) => {
  const key = req.params.key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  res.json(await DB.getData(key));
});

app.post('/api/data/:key', requireAuth, async (req, res) => {
  const key = req.params.key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  await DB.setData(key, req.body);
  res.json({ ok: true });
});

// HEALTH CHECK
app.get('/health', (req, res) => res.json({ status: 'ok', db: db ? 'connected' : 'memory' }));

// ── SERVE HTML PAGES ──
// Schütze Apps: User muss eingeloggt sein
app.get('/apps/:appId/*', async (req, res, next) => {
  const token = req.cookies?.session;
  if (!token) return res.redirect('/?redirect=' + encodeURIComponent(req.originalUrl));
  const session = await DB.getSession(token);
  if (!session) return res.redirect('/?redirect=' + encodeURIComponent(req.originalUrl));
  // Check permission
  if (session.role !== 'admin') {
    const allApps = await DB.getApps();
    const appDoc = allApps.find(a => a.appId === req.params.appId);
    if (appDoc) {
      const perms = await DB.getPermissions(session.userId);
      const hasAccess = perms.some(p => p.appId === (appDoc._id?.toString() || appDoc._id));
      if (!hasAccess) return res.status(403).send('<h2>Kein Zugriff auf diese App</h2><a href="/portal">Zurück</a>');
    }
  }
  next();
});

app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║  AUTOCENTER SÄNTIS – Firmenportal    ║`);
    console.log(`  ║  Port: ${PORT}                          ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
    console.log(`  Admin-Login: admin / Admin@Saentis2026\n`);
  });
});
