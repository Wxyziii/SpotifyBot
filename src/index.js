const { mainMenu } = require('./menu');
const { validate } = require('./config');
const { loadTokens, getActivePlaylistId, getArtists } = require('./store');
const { runScan, startScheduler } = require('./scheduler');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n  👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n  👋 Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('  ⚠️  Unhandled rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('  ⚠️  Uncaught exception:', err.message);
});

// --bot flag: skip menu, go straight to 24/7 scanning (for PM2)
async function botMode() {
  console.log('\n  🎵 Spotify Release Bot (bot mode)\n');
  validate(['clientId', 'clientSecret']);

  if (!loadTokens()) {
    console.error('  ❌ Not authenticated. Run `npm start` interactively first.');
    process.exit(1);
  }

  if (!getActivePlaylistId()) {
    console.error('  ❌ No playlist selected. Run `npm start` interactively and select one.');
    process.exit(1);
  }

  if (!getArtists().length) {
    console.error('  ❌ No artists tracked. Run `npm start` interactively to add some.');
    process.exit(1);
  }

  await runScan();
  startScheduler();
  console.log('  🟢 Bot is running. Scans will happen automatically.\n');
}

if (process.argv.includes('--bot')) {
  botMode().catch((err) => {
    console.error('  ❌ Fatal error:', err.message);
    process.exit(1);
  });
} else {
  mainMenu().catch((err) => {
    console.error('  ❌ Fatal error:', err.message);
    process.exit(1);
  });
}
