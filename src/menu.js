const readline = require('readline');
const { config, validate } = require('./config');
const { loadTokens, getArtists, addArtist, removeArtist } = require('./store');
const { authenticate } = require('./auth');
const { searchArtists } = require('./spotify-client');
const { scanFullCatalog } = require('./scanner');
const { addNewTracksToPlaylist } = require('./playlist');
const { runScan, startScheduler } = require('./scheduler');

let rl;

function createRl() {
  if (rl) rl.close();
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return rl;
}

function ask(question) {
  return new Promise((resolve) => createRl().question(question, resolve));
}

function clearScreen() {
  process.stdout.write('\x1B[2J\x1B[0f');
}

function isAuthenticated() {
  return !!loadTokens();
}

function printBanner() {
  clearScreen();
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         🎵  Spotify Release Bot          ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');

  const authStatus = isAuthenticated() ? '✅ Authenticated' : '❌ Not authenticated';
  const artists = getArtists();
  const playlist = config.targetPlaylistId || 'Not set';

  console.log(`  Status:    ${authStatus}`);
  console.log(`  Artists:   ${artists.length} tracked`);
  console.log(`  Playlist:  ${playlist}`);
  console.log(`  Interval:  Every ${config.scanIntervalHours}h`);
  console.log('');
}

function printMenu() {
  const auth = isAuthenticated();
  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │  1.  🔐  Authenticate with Spotify       │');
  console.log('  │  2.  ➕  Add artist                      │');
  console.log('  │  3.  ➖  Remove artist                   │');
  console.log('  │  4.  📋  View tracked artists            │');
  console.log('  │  5.  📀  Add all songs to playlist       │');
  console.log('  │  6.  🔍  Run scan now                    │');
  console.log('  │  7.  🚀  Start bot (24/7 auto-scan)     │');
  console.log('  │  0.  🚪  Exit                            │');
  console.log('  └──────────────────────────────────────────┘');

  if (!auth) {
    console.log('\n  ⚠️  Authenticate first (option 1) to use other features.');
  }
  console.log('');
}

// --- Menu actions ---

async function handleAuth() {
  validate(['clientId', 'clientSecret', 'redirectUri']);
  await authenticate();
  console.log('\n  Press Enter to return to menu...');
  await ask('');
}

async function handleAddArtist() {
  if (!isAuthenticated()) {
    console.log('\n  ❌ Authenticate first (option 1).\n');
    await ask('  Press Enter to continue...');
    return;
  }

  const query = await ask('  Enter artist name to search: ');
  if (!query.trim()) return;

  console.log(`\n  🔍 Searching for "${query.trim()}"...\n`);

  try {
    const artists = await searchArtists(query.trim());

    if (!artists.length) {
      console.log('  ❌ No artists found. Try a different name.\n');
      await ask('  Press Enter to continue...');
      return;
    }

    console.log('  ' + '─'.repeat(50));
    artists.forEach((artist, i) => {
      const followers = artist.followers?.total?.toLocaleString() || '0';
      const genres = artist.genres?.slice(0, 3).join(', ') || 'N/A';
      console.log(`    ${i + 1}. ${artist.name}`);
      console.log(`       Followers: ${followers} | Genres: ${genres}`);
    });
    console.log('  ' + '─'.repeat(50));
    console.log(`    0. Cancel\n`);

    const answer = await ask('  Select an artist (number): ');
    const index = parseInt(answer, 10);

    if (index === 0 || isNaN(index) || index < 1 || index > artists.length) {
      console.log('  Cancelled.\n');
      return;
    }

    const selected = artists[index - 1];
    const added = addArtist({ name: selected.name, id: selected.id });

    if (added) {
      console.log(`\n  ✅ Now tracking: ${selected.name}\n`);
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}\n`);
  }

  await ask('  Press Enter to continue...');
}

async function handleRemoveArtist() {
  const artists = getArtists();
  if (!artists.length) {
    console.log('\n  ℹ️  No artists tracked yet.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  console.log('\n  Tracked artists:');
  console.log('  ' + '─'.repeat(50));
  artists.forEach((a, i) => {
    console.log(`    ${i + 1}. ${a.name}  (${a.id})`);
  });
  console.log('  ' + '─'.repeat(50));
  console.log(`    0. Cancel\n`);

  const answer = await ask('  Select artist to remove (number): ');
  const index = parseInt(answer, 10);

  if (index === 0 || isNaN(index) || index < 1 || index > artists.length) {
    console.log('  Cancelled.\n');
    return;
  }

  const target = artists[index - 1];
  const removed = removeArtist(target.id);
  if (removed) {
    console.log(`\n  ✅ Removed: ${removed.name}\n`);
  }

  await ask('  Press Enter to continue...');
}

async function handleViewArtists() {
  const artists = getArtists();
  console.log('');
  if (!artists.length) {
    console.log('  ℹ️  No artists tracked yet. Use option 2 to add some.\n');
  } else {
    console.log(`  Tracked artists (${artists.length}):`);
    console.log('  ' + '─'.repeat(50));
    artists.forEach((a, i) => {
      console.log(`    ${i + 1}. ${a.name}  (${a.id})`);
    });
    console.log('  ' + '─'.repeat(50));
    console.log('');
  }
  await ask('  Press Enter to continue...');
}

async function handleAddAll() {
  if (!isAuthenticated()) {
    console.log('\n  ❌ Authenticate first (option 1).\n');
    await ask('  Press Enter to continue...');
    return;
  }

  validate(['clientId', 'clientSecret', 'targetPlaylistId']);

  const artists = getArtists();
  if (!artists.length) {
    console.log('\n  ⚠️  No artists tracked. Add artists first (option 2).\n');
    await ask('  Press Enter to continue...');
    return;
  }

  const confirm = await ask(`  This will add ALL songs from ${artists.length} artist(s). Continue? (y/n): `);
  if (confirm.toLowerCase() !== 'y') {
    console.log('  Cancelled.\n');
    return;
  }

  console.log('');
  const startTime = new Date();
  const allTracks = await scanFullCatalog();
  const addedCount = await addNewTracksToPlaylist(allTracks);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n  ✅ Done! Added ${addedCount} track(s) in ${durationSec}s.\n`);
  await ask('  Press Enter to continue...');
}

async function handleRunScan() {
  if (!isAuthenticated()) {
    console.log('\n  ❌ Authenticate first (option 1).\n');
    await ask('  Press Enter to continue...');
    return;
  }

  validate(['clientId', 'clientSecret', 'targetPlaylistId']);
  console.log('');
  await runScan();
  await ask('\n  Press Enter to continue...');
}

async function handleStartBot() {
  if (!isAuthenticated()) {
    console.log('\n  ❌ Authenticate first (option 1).\n');
    await ask('  Press Enter to continue...');
    return;
  }

  validate(['clientId', 'clientSecret', 'targetPlaylistId']);

  const artists = getArtists();
  if (!artists.length) {
    console.log('\n  ⚠️  No artists tracked. Add artists first (option 2).\n');
    await ask('  Press Enter to continue...');
    return;
  }

  if (rl) rl.close();
  rl = null;

  console.log('\n  🚀 Starting 24/7 bot mode...');
  console.log('  Press Ctrl+C to stop and return to shell.\n');

  await runScan();
  startScheduler();

  console.log('  🟢 Bot is running. Scans will happen automatically.\n');

  // Keep process alive — no more menu
  await new Promise(() => {});
}

// --- Main loop ---

async function mainMenu() {
  validate(['clientId', 'clientSecret']);

  while (true) {
    printBanner();
    printMenu();

    const choice = await ask('  Select an option: ');

    switch (choice.trim()) {
      case '1':
        await handleAuth();
        break;
      case '2':
        await handleAddArtist();
        break;
      case '3':
        await handleRemoveArtist();
        break;
      case '4':
        await handleViewArtists();
        break;
      case '5':
        await handleAddAll();
        break;
      case '6':
        await handleRunScan();
        break;
      case '7':
        await handleStartBot();
        break;
      case '0':
        console.log('\n  👋 Goodbye!\n');
        if (rl) rl.close();
        process.exit(0);
      default:
        console.log('\n  ⚠️  Invalid option.\n');
        await ask('  Press Enter to continue...');
    }
  }
}

module.exports = { mainMenu };
