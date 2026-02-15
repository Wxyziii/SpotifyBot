const fs = require('fs');
const path = require('path');
const { config } = require('./config');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Main store (artists, lastChecked) ---

function loadStore() {
  try {
    if (fs.existsSync(config.storePath)) {
      return JSON.parse(fs.readFileSync(config.storePath, 'utf-8'));
    }
  } catch (err) {
    console.error('⚠️  Failed to read store, resetting:', err.message);
  }
  return { artists: [], lastChecked: null };
}

function saveStore(data) {
  ensureDir(config.storePath);
  fs.writeFileSync(config.storePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getArtists() {
  return loadStore().artists || [];
}

function addArtist(artist) {
  const store = loadStore();
  if (store.artists.some((a) => a.id === artist.id)) {
    console.log(`ℹ️  Artist "${artist.name}" is already tracked.`);
    return false;
  }
  store.artists.push({ name: artist.name, id: artist.id });
  saveStore(store);
  return true;
}

function getLastChecked() {
  return loadStore().lastChecked;
}

function setLastChecked(isoString) {
  const store = loadStore();
  store.lastChecked = isoString;
  saveStore(store);
}

function removeArtist(artistId) {
  const store = loadStore();
  const index = store.artists.findIndex((a) => a.id === artistId);
  if (index === -1) return false;
  const [removed] = store.artists.splice(index, 1);
  saveStore(store);
  return removed;
}

// --- Token store ---

function loadTokens() {
  try {
    if (fs.existsSync(config.tokensPath)) {
      return JSON.parse(fs.readFileSync(config.tokensPath, 'utf-8'));
    }
  } catch (err) {
    console.error('⚠️  Failed to read tokens:', err.message);
  }
  return null;
}

function saveTokens(tokens) {
  ensureDir(config.tokensPath);
  fs.writeFileSync(config.tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');
}

module.exports = {
  loadStore,
  saveStore,
  getArtists,
  addArtist,
  removeArtist,
  getLastChecked,
  setLastChecked,
  loadTokens,
  saveTokens,
};
