// ═══════════════════════════════════════════════
// AUTOCENTER SÄNTIS – Zielvereinbarung 2026
// Node.js + MongoDB Atlas – Cloud Version
// ═══════════════════════════════════════════════
const express    = require('express');
const { MongoClient } = require('mongodb');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// MongoDB Verbindung (wird über Umgebungsvariable gesetzt)
const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME   = 'saentis2026';

let db = null;

// MongoDB verbinden
async function connectDB() {
  if (!MONGO_URI) {
    console.log('  ⚠  MONGO_URI nicht gesetzt – starte ohne Datenbank (nur RAM)');
    return;
  }
  try {
    const client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    db = client.db(DB_NAME);
    console.log('  ✓  MongoDB Atlas verbunden');
  } catch (e) {
    console.error('  ✗  MongoDB Verbindungsfehler:', e.message);
    console.log('  →  App läuft ohne Datenbank (Daten nur im RAM)');
  }
}

// In-Memory Fallback wenn keine DB
const memStore = {};

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── API: Daten lesen ──
app.get('/api/data/:key', async (req, res) => {
  const key = req.params.key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    if (db) {
      const doc = await db.collection('data').findOne({ _id: key });
      return res.json(doc ? doc.value : null);
    }
    return res.json(memStore[key] || null);
  } catch(e) {
    res.json(memStore[key] || null);
  }
});

// ── API: Daten schreiben ──
app.post('/api/data/:key', async (req, res) => {
  const key = req.params.key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    if (db) {
      await db.collection('data').replaceOne(
        { _id: key },
        { _id: key, value: req.body, updatedAt: new Date() },
        { upsert: true }
      );
    } else {
      memStore[key] = req.body;
    }
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Alle Keys listen ──
app.get('/api/keys', async (req, res) => {
  try {
    if (db) {
      const docs = await db.collection('data').find({}, { projection: { _id: 1 } }).toArray();
      return res.json(docs.map(d => d._id));
    }
    return res.json(Object.keys(memStore));
  } catch(e) {
    res.json([]);
  }
});

// ── Health Check für Railway ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: db ? 'connected' : 'disconnected' });
});

// ── Alle anderen Routen → index.html ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║  AUTOCENTER SÄNTIS                   ║');
    console.log('  ║  Zielvereinbarung 2026               ║');
    console.log(`  ║  Port: ${PORT}                          ║`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
});
