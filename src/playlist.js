const { getPlaylistTracks, addTracksToPlaylist, replacePlaylistTracks, getArtistAlbums, getAlbumTracks } = require('./spotify-client');
const { getActivePlaylistId, getArtists } = require('./store');

async function addNewTracksToPlaylist(newTracks, playlistId) {
  const pid = playlistId || getActivePlaylistId();
  if (!pid) {
    console.log('❌ No playlist selected. Use the menu to select a playlist.');
    return 0;
  }

  if (!newTracks.length) {
    console.log('ℹ️  No new tracks to add.');
    return 0;
  }

  console.log(`\n📋 Fetching existing playlist tracks...`);

  const existingItems = await getPlaylistTracks(pid);
  const existingUris = new Set(
    existingItems
      .filter((item) => item.track)
      .map((item) => item.track.uri)
  );

  console.log(`   Playlist currently has ${existingUris.size} track(s).`);

  const newUris = newTracks
    .map((t) => t.uri)
    .filter((uri) => uri && !existingUris.has(uri));

  const uniqueNewUris = [...new Set(newUris)];

  if (!uniqueNewUris.length) {
    console.log('ℹ️  All found tracks already exist in the playlist.');
    return 0;
  }

  console.log(`➕ Adding ${uniqueNewUris.length} new track(s) to playlist...`);
  await addTracksToPlaylist(pid, uniqueNewUris);
  console.log(`✅ Successfully added ${uniqueNewUris.length} track(s)!`);

  return uniqueNewUris.length;
}

/**
 * Sync playlist: scan what should be there based on tracked artists,
 * compare with what's in the playlist, and add missing tracks.
 */
async function syncPlaylist(playlistId) {
  const pid = playlistId || getActivePlaylistId();
  if (!pid) {
    console.log('❌ No playlist selected.');
    return 0;
  }

  const artists = getArtists();
  if (!artists.length) {
    console.log('⚠️  No artists tracked.');
    return 0;
  }

  console.log(`\n🔄 Syncing playlist...`);
  console.log(`📋 Fetching existing playlist tracks...`);

  const existingItems = await getPlaylistTracks(pid);
  const existingUris = new Set(
    existingItems
      .filter((item) => item.track)
      .map((item) => item.track.uri)
  );

  console.log(`   Playlist currently has ${existingUris.size} track(s).`);
  console.log(`🎤 Scanning ${artists.length} artist(s) for all tracks...\n`);

  const missingUris = [];

  for (const artist of artists) {
    try {
      console.log(`  🔍 ${artist.name}...`);
      const albums = await getArtistAlbums(artist.id);

      for (const album of albums) {
        const tracks = await getAlbumTracks(album.id);
        for (const track of tracks) {
          if (track.uri && !existingUris.has(track.uri)) {
            missingUris.push(track.uri);
            existingUris.add(track.uri); // avoid duplicates in batch
          }
        }
      }
    } catch (err) {
      console.error(`  ❌ Error scanning ${artist.name}: ${err.message}`);
    }
  }

  const unique = [...new Set(missingUris)];

  if (!unique.length) {
    console.log('\n✅ Playlist is fully synced — no missing tracks.');
    return 0;
  }

  console.log(`\n➕ Adding ${unique.length} missing track(s)...`);
  await addTracksToPlaylist(pid, unique);
  console.log(`✅ Synced! Added ${unique.length} track(s).`);

  return unique.length;
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function shufflePlaylist(playlistId) {
  const pid = playlistId || getActivePlaylistId();
  if (!pid) {
    console.log('❌ No playlist selected.');
    return;
  }

  console.log('\n🔀 Fetching playlist tracks...');
  const items = await getPlaylistTracks(pid);
  const uris = items
    .filter((item) => item.track)
    .map((item) => item.track.uri);

  if (!uris.length) {
    console.log('ℹ️  Playlist is empty, nothing to shuffle.');
    return;
  }

  console.log(`   Shuffling ${uris.length} track(s)...`);
  const shuffled = shuffleArray(uris);

  console.log('   Replacing playlist order...');
  await replacePlaylistTracks(pid, shuffled);
  console.log(`✅ Playlist shuffled! (${uris.length} tracks randomized)`);
}

module.exports = { addNewTracksToPlaylist, syncPlaylist, shufflePlaylist };
