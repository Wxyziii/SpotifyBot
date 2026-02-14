const { config, validate } = require('./config');
const { loadTokens } = require('./store');
const { runScan, startScheduler } = require('./scheduler');

async function main() {
  console.log('\n🎵 Spotify Release Bot');
  console.log('─'.repeat(40));

  validate(['clientId', 'clientSecret', 'targetPlaylistId']);

  const tokens = loadTokens();
  if (!tokens) {
    console.error('❌ Not authenticated. Run first: npm run auth');
    process.exit(1);
  }

  console.log(`📋 Target playlist: ${config.targetPlaylistId}`);
  console.log(`⏰ Scan interval: every ${config.scanIntervalHours} hour(s)\n`);

  // Run an immediate scan on startup
  await runScan();

  // Start the recurring scheduler
  startScheduler();

  console.log('🟢 Bot is running. Press Ctrl+C to stop.\n');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Catch unhandled rejections so the bot never crashes
process.on('unhandledRejection', (err) => {
  console.error('⚠️  Unhandled rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught exception:', err.message);
});

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
