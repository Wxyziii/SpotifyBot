const { getPlaylistTracks, addTracksToPlaylist } = require('./spotify-client');
const { config } = require('./config');

async function addNewTracksToPlaylist(newTracks) {
  if (!newTracks.length) {
    console.log('ℹ️  No new tracks to add.');
    return 0;
  }

  const playlistId = config.targetPlaylistId;
  console.log(`\n📋 Fetching existing playlist tracks...`);

  const existingItems = await getPlaylistTracks(playlistId);
  const existingUris = new Set(
    existingItems
      .filter((item) => item.track)
      .map((item) => item.track.uri)
  );

  console.log(`   Playlist currently has ${existingUris.size} track(s).`);

  // Filter out duplicates
  const newUris = newTracks
    .map((t) => t.uri)
    .filter((uri) => uri && !existingUris.has(uri));

  // Deduplicate within the new batch itself
  const uniqueNewUris = [...new Set(newUris)];

  if (!uniqueNewUris.length) {
    console.log('ℹ️  All found tracks already exist in the playlist.');
    return 0;
  }

  console.log(`➕ Adding ${uniqueNewUris.length} new track(s) to playlist...`);
  await addTracksToPlaylist(playlistId, uniqueNewUris);
  console.log(`✅ Successfully added ${uniqueNewUris.length} track(s)!`);

  return uniqueNewUris.length;
}

module.exports = { addNewTracksToPlaylist };
