const { config, validate } = require('./config');
const { loadTokens } = require('./store');
const { scanFullCatalog } = require('./scanner');
const { addNewTracksToPlaylist } = require('./playlist');

async function main() {
  console.log('\n🎵 Spotify Bot — Add All Songs');
  console.log('─'.repeat(40));

  validate(['clientId', 'clientSecret', 'targetPlaylistId']);

  const tokens = loadTokens();
  if (!tokens) {
    console.error('❌ Not authenticated. Run first: npm run auth');
    process.exit(1);
  }

  console.log(`📋 Target playlist: ${config.targetPlaylistId}\n`);

  const startTime = new Date();
  console.log(`🚀 Started at ${startTime.toISOString()}\n`);

  const allTracks = await scanFullCatalog();
  const addedCount = await addNewTracksToPlaylist(allTracks);

  const endTime = new Date();
  const durationSec = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Done at ${endTime.toISOString()}`);
  console.log(`   Duration: ${durationSec}s | Tracks added: ${addedCount}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
