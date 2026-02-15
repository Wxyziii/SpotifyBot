const readline = require('readline');
const { config, validate } = require('./config');
const {
  loadTokens, getArtists, addArtist, addArtists, removeArtist,
  getActivePlaylistId, setActivePlaylistId,
  getPresets, savePreset, deletePreset, applyPreset,
} = require('./store');
const { authenticate } = require('./auth');
const { searchArtists, getFollowedArtists, getUserPlaylists } = require('./spotify-client');
const { scanFullCatalog } = require('./scanner');
const { addNewTracksToPlaylist, syncPlaylist } = require('./playlist');
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

function requireAuth() {
  if (!isAuthenticated()) {
    console.log('\n  ❌ Authenticate first (option 1).\n');
    return false;
  }
  return true;
}

function printBanner() {
  clearScreen();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║            🎵  Spotify Release Bot               ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  const authStatus = isAuthenticated() ? '✅ Authenticated' : '❌ Not authenticated';
  const artists = getArtists();
  const playlistId = getActivePlaylistId();
  const playlist = playlistId || '⚠️  Not selected';

  console.log(`  Status:    ${authStatus}`);
  console.log(`  Artists:   ${artists.length} tracked`);
  console.log(`  Playlist:  ${playlist}`);
  console.log(`  Interval:  Every ${config.scanIntervalHours}h`);
  console.log('');
}

function printMenu() {
  console.log('  ┌────────────────────────────────────────────────────┐');
  console.log('  │  1.   🔐  Authenticate with Spotify               │');
  console.log('  │  2.   ➕  Add artist (search)                     │');
  console.log('  │  3.   ➖  Remove artist                           │');
  console.log('  │  4.   📋  View tracked artists                    │');
  console.log('  │  5.   👥  Import from followed artists            │');
  console.log('  │  6.   🎯  Select playlist                         │');
  console.log('  │  7.   📀  Add all songs to playlist               │');
  console.log('  │  8.   🔄  Sync playlist (add missing)             │');
  console.log('  │  9.   🔍  Run scan now                            │');
  console.log('  │  10.  🚀  Start bot (24/7 auto-scan)              │');
  console.log('  │  11.  💾  Presets (save/load/delete)               │');
  console.log('  │  0.   🚪  Exit                                    │');
  console.log('  └────────────────────────────────────────────────────┘');

  if (!isAuthenticated()) {
    console.log('\n  ⚠️  Authenticate first (option 1) to use other features.');
  }
  console.log('');
}

// --- Helpers ---

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

// --- Menu actions ---

async function handleAuth() {
  validate(['clientId', 'clientSecret', 'redirectUri']);
  await authenticate();
  console.log('\n  Press Enter to return to menu...');
  await ask('');
}

async function handleAddArtist() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  const query = await ask('  Enter artist name to search: ');
  if (!query.trim()) return;

  console.log(`\n  🔍 Searching for "${query.trim()}"...\n`);

  try {
    const artists = await searchArtists(query.trim());

    if (!artists.length) {
      console.log('  ❌ No artists found.\n');
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
    if (added) console.log(`\n  ✅ Now tracking: ${selected.name}\n`);
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
    console.log(`    ${i + 1}. ${a.name}`);
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
  if (removed) console.log(`\n  ✅ Removed: ${removed.name}\n`);

  await ask('  Press Enter to continue...');
}

async function handleViewArtists() {
  const artists = getArtists();
  console.log('');
  if (!artists.length) {
    console.log('  ℹ️  No artists tracked yet.\n');
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

async function handleImportFollowed() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  console.log('\n  📡 Fetching your followed artists from Spotify...\n');

  try {
    const followed = await getFollowedArtists();

    if (!followed.length) {
      console.log('  ℹ️  You don\'t follow any artists on Spotify.\n');
      await ask('  Press Enter to continue...');
      return;
    }

    const selected = new Set();
    const currentArtists = getArtists();
    const currentIds = new Set(currentArtists.map((a) => a.id));

    const COLS = 3;
    const ROWS = 10;
    const PER_PAGE = COLS * ROWS;
    const totalPages = Math.ceil(followed.length / PER_PAGE);
    let page = 0;

    while (true) {
      clearScreen();
      const start = page * PER_PAGE;
      const end = Math.min(start + PER_PAGE, followed.length);
      const pageItems = followed.slice(start, end);

      console.log('');
      console.log(`  👥 Followed Artists — Page ${page + 1}/${totalPages}  (${selected.size} selected)`);
      console.log('  ✓ = already tracked  ★ = selected');
      console.log('  ' + '─'.repeat(75));

      // Build grid rows
      const colWidth = 25;
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        const cells = [];
        for (let c = 0; c < COLS; c++) {
          const idx = r + c * ROWS;
          if (idx >= pageItems.length) { cells.push(''); continue; }
          const globalIdx = start + idx;
          const artist = followed[globalIdx];
          const tracked = currentIds.has(artist.id);
          const sel = selected.has(globalIdx);
          let marker = '  ';
          if (tracked) marker = ' ✓';
          else if (sel) marker = ' ★';
          const num = String(globalIdx + 1).padStart(3);
          const name = artist.name.length > colWidth - 8
            ? artist.name.slice(0, colWidth - 11) + '...'
            : artist.name;
          cells.push(`${num}.${marker} ${name}`.padEnd(colWidth));
        }
        if (cells.some((c) => c.trim())) {
          rows.push('    ' + cells.join('  '));
        }
      }
      rows.forEach((r) => console.log(r));

      console.log('  ' + '─'.repeat(75));
      console.log('');
      const nav = [];
      if (page > 0) nav.push('"p" prev page');
      if (page < totalPages - 1) nav.push('"n" next page');
      nav.push('"all" select all', '"none" clear', '"done" confirm', '"cancel" abort');
      console.log(`  ${nav.join(' | ')}`);
      console.log('  Toggle: enter numbers/ranges (e.g. "1 3 5" or "1-10")\n');

      const input = await ask('  > ');
      const cmd = input.trim().toLowerCase();

      if (cmd === 'cancel') {
        console.log('  Cancelled.\n');
        await ask('  Press Enter to continue...');
        return;
      }

      if (cmd === 'done') break;
      if (cmd === 'n' && page < totalPages - 1) { page++; continue; }
      if (cmd === 'p' && page > 0) { page--; continue; }

      if (cmd === 'all') {
        followed.forEach((a, i) => {
          if (!currentIds.has(a.id)) selected.add(i);
        });
        continue;
      }

      if (cmd === 'none') {
        selected.clear();
        continue;
      }

      // Parse numbers and ranges
      const parts = cmd.split(/[\s,]+/);
      for (const part of parts) {
        const rangeMatch = part.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const s = parseInt(rangeMatch[1], 10) - 1;
          const e = parseInt(rangeMatch[2], 10) - 1;
          for (let i = Math.max(0, s); i <= Math.min(followed.length - 1, e); i++) {
            if (!currentIds.has(followed[i].id)) {
              if (selected.has(i)) selected.delete(i); else selected.add(i);
            }
          }
        } else {
          const idx = parseInt(part, 10) - 1;
          if (idx >= 0 && idx < followed.length && !currentIds.has(followed[idx].id)) {
            if (selected.has(idx)) selected.delete(idx); else selected.add(idx);
          }
        }
      }
    }

    if (!selected.size) {
      console.log('  ℹ️  No new artists selected.\n');
      await ask('  Press Enter to continue...');
      return;
    }

    const toAdd = [...selected].map((i) => ({ name: followed[i].name, id: followed[i].id }));
    const count = addArtists(toAdd);
    console.log(`\n  ✅ Added ${count} new artist(s) to tracking.\n`);
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}\n`);
  }

  await ask('  Press Enter to continue...');
}

async function handleSelectPlaylist() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  console.log('\n  📡 Fetching your playlists...\n');

  try {
    const playlists = await getUserPlaylists();

    if (!playlists.length) {
      console.log('  ℹ️  No playlists found.\n');
      await ask('  Press Enter to continue...');
      return;
    }

    const currentId = getActivePlaylistId();
    console.log('  ' + '─'.repeat(55));
    playlists.forEach((pl, i) => {
      const active = pl.id === currentId ? ' ← active' : '';
      const tracks = pl.tracks?.total || 0;
      console.log(`    ${i + 1}. ${pl.name}  (${tracks} tracks)${active}`);
    });
    console.log('  ' + '─'.repeat(55));
    console.log(`    0. Cancel\n`);

    const answer = await ask('  Select a playlist (number): ');
    const index = parseInt(answer, 10);

    if (index === 0 || isNaN(index) || index < 1 || index > playlists.length) {
      console.log('  Cancelled.\n');
      await ask('  Press Enter to continue...');
      return;
    }

    const selected = playlists[index - 1];
    setActivePlaylistId(selected.id);
    console.log(`\n  ✅ Active playlist: ${selected.name} (${selected.id})\n`);
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}\n`);
  }

  await ask('  Press Enter to continue...');
}

async function handleAddAll() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  const playlistId = getActivePlaylistId();
  if (!playlistId) {
    console.log('\n  ⚠️  No playlist selected. Use option 6 first.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  const artists = getArtists();
  if (!artists.length) {
    console.log('\n  ⚠️  No artists tracked. Add artists first.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  // Release type selection
  console.log('\n  Release type:');
  console.log('    1. Everything (albums + singles/EPs)');
  console.log('    2. Albums only');
  console.log('    3. Singles/EPs only\n');

  const typeChoice = await ask('  Select type (1-3): ');
  let releaseType = 'everything';
  if (typeChoice.trim() === '2') releaseType = 'albums';
  else if (typeChoice.trim() === '3') releaseType = 'singles';

  // Date range
  console.log('\n  Date range (leave blank for no filter):');
  const fromInput = await ask('  From date (YYYY-MM-DD): ');
  const toInput = await ask('  To date   (YYYY-MM-DD): ');

  const dateFrom = isValidDate(fromInput.trim()) ? fromInput.trim() : null;
  const dateTo = isValidDate(toInput.trim()) ? toInput.trim() : null;

  const typeLabel = releaseType === 'everything' ? 'all releases' : releaseType;
  const rangeLabel = dateFrom || dateTo
    ? ` from ${dateFrom || '...'} to ${dateTo || '...'}`
    : '';

  const confirm = await ask(`\n  Add ${typeLabel}${rangeLabel} from ${artists.length} artist(s)? (y/n): `);
  if (confirm.toLowerCase() !== 'y') {
    console.log('  Cancelled.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  console.log('');
  const startTime = Date.now();
  const allTracks = await scanFullCatalog({ releaseType, dateFrom, dateTo });
  const addedCount = await addNewTracksToPlaylist(allTracks, playlistId);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n  ✅ Done! Added ${addedCount} track(s) in ${durationSec}s.\n`);
  await ask('  Press Enter to continue...');
}

async function handleSyncPlaylist() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  const playlistId = getActivePlaylistId();
  if (!playlistId) {
    console.log('\n  ⚠️  No playlist selected. Use option 6 first.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  const artists = getArtists();
  if (!artists.length) {
    console.log('\n  ⚠️  No artists tracked.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  console.log('');
  const startTime = Date.now();
  const addedCount = await syncPlaylist(playlistId);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n  Sync complete in ${durationSec}s. Tracks added: ${addedCount}\n`);
  await ask('  Press Enter to continue...');
}

async function handleRunScan() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  const playlistId = getActivePlaylistId();
  if (!playlistId) {
    console.log('\n  ⚠️  No playlist selected. Use option 6 first.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  console.log('');
  await runScan();
  await ask('\n  Press Enter to continue...');
}

async function handleStartBot() {
  if (!requireAuth()) { await ask('  Press Enter to continue...'); return; }

  const playlistId = getActivePlaylistId();
  if (!playlistId) {
    console.log('\n  ⚠️  No playlist selected. Use option 6 first.\n');
    await ask('  Press Enter to continue...');
    return;
  }

  const artists = getArtists();
  if (!artists.length) {
    console.log('\n  ⚠️  No artists tracked. Add artists first.\n');
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
  await new Promise(() => {});
}

async function handlePresets() {
  while (true) {
    const presets = getPresets();
    const presetNames = Object.keys(presets);
    const artists = getArtists();

    console.log('\n  ┌──────────────────────────────────────────┐');
    console.log('  │          💾  Preset Manager               │');
    console.log('  └──────────────────────────────────────────┘');
    console.log('');

    if (presetNames.length) {
      console.log('  Saved presets:');
      console.log('  ' + '─'.repeat(50));
      presetNames.forEach((name, i) => {
        console.log(`    ${i + 1}. ${name}  (${presets[name].length} artists)`);
      });
      console.log('  ' + '─'.repeat(50));
    } else {
      console.log('  No presets saved yet.');
    }
    console.log('');

    console.log('  Actions:');
    console.log('    s.  Save current artists as preset');
    console.log('    l.  Load a preset (replaces current artists)');
    console.log('    d.  Delete a preset');
    console.log('    b.  Back to main menu\n');

    const choice = (await ask('  Select action: ')).trim().toLowerCase();

    if (choice === 'b') return;

    if (choice === 's') {
      if (!artists.length) {
        console.log('\n  ⚠️  No artists tracked to save.\n');
        await ask('  Press Enter to continue...');
        continue;
      }
      const name = await ask('  Preset name: ');
      if (!name.trim()) continue;
      savePreset(name.trim(), artists);
      console.log(`\n  ✅ Saved preset "${name.trim()}" with ${artists.length} artist(s).\n`);
      await ask('  Press Enter to continue...');
    }

    if (choice === 'l') {
      if (!presetNames.length) {
        console.log('\n  ℹ️  No presets to load.\n');
        await ask('  Press Enter to continue...');
        continue;
      }
      const answer = await ask('  Enter preset number to load: ');
      const idx = parseInt(answer, 10) - 1;
      if (idx < 0 || idx >= presetNames.length) {
        console.log('  Cancelled.\n');
        continue;
      }
      const presetName = presetNames[idx];
      const confirm = await ask(`  This will replace your current ${artists.length} artist(s). Continue? (y/n): `);
      if (confirm.toLowerCase() !== 'y') continue;
      applyPreset(presetName);
      const loaded = getArtists();
      console.log(`\n  ✅ Loaded preset "${presetName}" — now tracking ${loaded.length} artist(s).\n`);
      await ask('  Press Enter to continue...');
    }

    if (choice === 'd') {
      if (!presetNames.length) {
        console.log('\n  ℹ️  No presets to delete.\n');
        await ask('  Press Enter to continue...');
        continue;
      }
      const answer = await ask('  Enter preset number to delete: ');
      const idx = parseInt(answer, 10) - 1;
      if (idx < 0 || idx >= presetNames.length) {
        console.log('  Cancelled.\n');
        continue;
      }
      const presetName = presetNames[idx];
      deletePreset(presetName);
      console.log(`\n  ✅ Deleted preset "${presetName}".\n`);
      await ask('  Press Enter to continue...');
    }
  }
}

// --- Main loop ---

async function mainMenu() {
  validate(['clientId', 'clientSecret']);

  while (true) {
    printBanner();
    printMenu();

    const choice = (await ask('  Select an option: ')).trim();

    switch (choice) {
      case '1':  await handleAuth(); break;
      case '2':  await handleAddArtist(); break;
      case '3':  await handleRemoveArtist(); break;
      case '4':  await handleViewArtists(); break;
      case '5':  await handleImportFollowed(); break;
      case '6':  await handleSelectPlaylist(); break;
      case '7':  await handleAddAll(); break;
      case '8':  await handleSyncPlaylist(); break;
      case '9':  await handleRunScan(); break;
      case '10': await handleStartBot(); break;
      case '11': await handlePresets(); break;
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
