require('dotenv').config();

const config = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
  targetPlaylistId: process.env.TARGET_PLAYLIST_ID,
  scanIntervalHours: parseInt(process.env.SCAN_INTERVAL_HOURS, 10) || 12,
  authPort: parseInt(process.env.AUTH_PORT, 10) || 8888,
  scopes: [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
  ],
  storePath: require('path').join(__dirname, '..', 'data', 'store.json'),
  tokensPath: require('path').join(__dirname, '..', 'data', 'tokens.json'),
  retryAttempts: 3,
  retryDelayMs: 2000,
};

function validate(keys) {
  const missing = keys.filter((k) => !config[k]);
  if (missing.length) {
    console.error(`❌ Missing required config: ${missing.join(', ')}`);
    console.error('   Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }
}

module.exports = { config, validate };
