const express = require('express');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'pins.json');

function readPins() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writePins(pins) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(pins, null, 2));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/pins', (req, res) => {
  res.json(readPins());
});

app.post('/api/pins', (req, res) => {
  const { name, lat, lng } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'valid lat/lng are required' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng out of range' });
  }

  const pin = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.trim().slice(0, 60),
    lat,
    lng,
    createdAt: new Date().toISOString(),
  };

  const pins = readPins();
  pins.push(pin);
  writePins(pins);

  res.status(201).json(pin);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
