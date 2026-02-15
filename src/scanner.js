const { getArtistAlbums, getAlbumTracks } = require('./spotify-client');
const { getArtists, getLastChecked } = require('./store');

async function scanForNewReleases() {
  const artists = getArtists();
  const lastChecked = getLastChecked();

  if (!artists.length) {
    console.log('⚠️  No artists tracked. Add artists with: npm run add-artist "Artist Name"');
    return [];
  }

  // On first run with no lastChecked, look back 14 days
  const cutoffDate = lastChecked
    ? new Date(lastChecked)
    : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  console.log(`📅 Looking for releases after: ${cutoffDate.toISOString().split('T')[0]}`);
  console.log(`🎤 Scanning ${artists.length} artist(s)...\n`);

  const allNewTracks = [];

  for (const artist of artists) {
    try {
      console.log(`  🔍 ${artist.name}...`);
      const albums = await getArtistAlbums(artist.id);

      const newAlbums = albums.filter((album) => {
        const releaseDate = parseReleaseDate(album.release_date, album.release_date_precision);
        return releaseDate > cutoffDate;
      });

      if (!newAlbums.length) {
        console.log(`     No new releases.`);
        continue;
      }

      console.log(`     Found ${newAlbums.length} new release(s):`);

      for (const album of newAlbums) {
        console.log(`       📀 ${album.name} (${album.album_type}) — ${album.release_date}`);
        const tracks = await getAlbumTracks(album.id);
        allNewTracks.push(...tracks.map((t) => ({ ...t, _albumName: album.name, _artistName: artist.name })));
      }
    } catch (err) {
      console.error(`  ❌ Error scanning ${artist.name}: ${err.message}`);
      // Continue to next artist
    }
  }

  console.log(`\n📊 Total new tracks found: ${allNewTracks.length}`);
  return allNewTracks;
}

function parseReleaseDate(dateStr, precision) {
  // Spotify release_date can be "2024", "2024-01", or "2024-01-15"
  switch (precision) {
    case 'day':
      return new Date(dateStr);
    case 'month':
      return new Date(`${dateStr}-01`);
    case 'year':
      return new Date(`${dateStr}-01-01`);
    default:
      return new Date(dateStr);
  }
}

async function scanFullCatalog() {
  const artists = getArtists();

  if (!artists.length) {
    console.log('⚠️  No artists tracked. Add artists with: npm run add-artist "Artist Name"');
    return [];
  }

  console.log(`🎤 Fetching FULL catalog for ${artists.length} artist(s)...\n`);

  const allTracks = [];

  for (const artist of artists) {
    try {
      console.log(`  🔍 ${artist.name}...`);
      const albums = await getArtistAlbums(artist.id);

      console.log(`     Found ${albums.length} release(s):`);

      for (const album of albums) {
        console.log(`       📀 ${album.name} (${album.album_type}) — ${album.release_date}`);
        const tracks = await getAlbumTracks(album.id);
        allTracks.push(...tracks.map((t) => ({ ...t, _albumName: album.name, _artistName: artist.name })));
      }
    } catch (err) {
      console.error(`  ❌ Error scanning ${artist.name}: ${err.message}`);
    }
  }

  console.log(`\n📊 Total tracks found: ${allTracks.length}`);
  return allTracks;
}

module.exports = { scanForNewReleases, scanFullCatalog };
