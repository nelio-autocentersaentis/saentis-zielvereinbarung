// ═══════════════════════════════════════════════
// AUTOCENTER SÄNTIS – Zielvereinbarung 2026
// Node.js Server – Läuft auf Windows/Linux Server
// ═══════════════════════════════════════════════
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── HELPER ──
function dataFile(key) {
  // Sanitize key to prevent path traversal
  const safe = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(DATA, safe + '.json');
}

function readData(key) {
  try {
    const f = dataFile(key);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    return null;
  } catch(e) { return null; }
}

function writeData(key, data) {
  fs.writeFileSync(dataFile(key), JSON.stringify(data, null, 2), 'utf8');
}

// ── API ROUTES ──

// GET /api/data/:key  – Read a data file
app.get('/api/data/:key', (req, res) => {
  const data = readData(req.params.key);
  if (data === null) return res.json(null);
  res.json(data);
});

// POST /api/data/:key  – Write a data file
app.post('/api/data/:key', (req, res) => {
  try {
    writeData(req.params.key, req.body);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/keys  – List all data keys
app.get('/api/keys', (req, res) => {
  try {
    const files = fs.readdirSync(DATA)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
    res.json(files);
  } catch(e) {
    res.json([]);
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║  AUTOCENTER SÄNTIS                   ║');
  console.log('  ║  Zielvereinbarung 2026               ║');
  console.log(`  ║  Server läuft auf Port ${PORT}          ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  Lokal:   http://localhost:${PORT}`);
  console.log(`  Netzwerk: http://[SERVER-IP]:${PORT}`);
  console.log('');
  console.log('  Mit Ctrl+C beenden');
});
