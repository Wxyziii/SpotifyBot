const fs = require('fs');
const path = require('path');
const { config } = require('./config');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const DEFAULT_STORE = {
  artists: [],
  lastChecked: null,
  activePlaylistId: null,
  presets: {},
};

// --- Main store ---

function loadStore() {
  try {
    if (fs.existsSync(config.storePath)) {
      const data = JSON.parse(fs.readFileSync(config.storePath, 'utf-8'));
      return { ...DEFAULT_STORE, ...data };
    }
  } catch (err) {
    console.error('⚠️  Failed to read store, resetting:', err.message);
  }
  return { ...DEFAULT_STORE };
}

function saveStore(data) {
  ensureDir(config.storePath);
  fs.writeFileSync(config.storePath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Artists ---

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

function addArtists(artists) {
  const store = loadStore();
  let added = 0;
  for (const artist of artists) {
    if (!store.artists.some((a) => a.id === artist.id)) {
      store.artists.push({ name: artist.name, id: artist.id });
      added++;
    }
  }
  if (added) saveStore(store);
  return added;
}

function removeArtist(artistId) {
  const store = loadStore();
  const index = store.artists.findIndex((a) => a.id === artistId);
  if (index === -1) return false;
  const [removed] = store.artists.splice(index, 1);
  saveStore(store);
  return removed;
}

// --- Last checked ---

function getLastChecked() {
  return loadStore().lastChecked;
}

function setLastChecked(isoString) {
  const store = loadStore();
  store.lastChecked = isoString;
  saveStore(store);
}

// --- Active playlist ---

function getActivePlaylistId() {
  const store = loadStore();
  return store.activePlaylistId || config.targetPlaylistId || null;
}

function setActivePlaylistId(playlistId) {
  const store = loadStore();
  store.activePlaylistId = playlistId;
  saveStore(store);
}

// --- Presets ---

function getPresets() {
  return loadStore().presets || {};
}

function savePreset(name, artists) {
  const store = loadStore();
  if (!store.presets) store.presets = {};
  store.presets[name] = artists.map((a) => ({ name: a.name, id: a.id }));
  saveStore(store);
}

function loadPreset(name) {
  const presets = getPresets();
  return presets[name] || null;
}

function deletePreset(name) {
  const store = loadStore();
  if (!store.presets || !store.presets[name]) return false;
  delete store.presets[name];
  saveStore(store);
  return true;
}

function applyPreset(name) {
  const preset = loadPreset(name);
  if (!preset) return false;
  const store = loadStore();
  store.artists = [...preset];
  saveStore(store);
  return true;
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
  addArtists,
  removeArtist,
  getLastChecked,
  setLastChecked,
  getActivePlaylistId,
  setActivePlaylistId,
  getPresets,
  savePreset,
  loadPreset,
  deletePreset,
  applyPreset,
  loadTokens,
  saveTokens,
};
