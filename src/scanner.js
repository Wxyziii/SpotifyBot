const { getArtistAlbums, getAlbumTracks } = require('./spotify-client');
const { getArtists, getLastChecked } = require('./store');

function parseReleaseDate(dateStr, precision) {
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

// Maps user-friendly type to Spotify include_groups value
function resolveIncludeGroups(releaseType) {
  switch (releaseType) {
    case 'albums':
      return 'album';
    case 'singles':
      return 'single';
    case 'everything':
    default:
      return 'album,single';
  }
}

async function scanForNewReleases() {
  const artists = getArtists();
  const lastChecked = getLastChecked();

  if (!artists.length) {
    console.log('⚠️  No artists tracked.');
    return [];
  }

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
    }
  }

  console.log(`\n📊 Total new tracks found: ${allNewTracks.length}`);
  return allNewTracks;
}

/**
 * Scan full catalog with optional filters.
 * @param {Object} options
 * @param {string} options.releaseType - 'albums', 'singles', or 'everything'
 * @param {string|null} options.dateFrom - ISO date string (start of range)
 * @param {string|null} options.dateTo - ISO date string (end of range)
 */
async function scanFullCatalog({ releaseType = 'everything', dateFrom = null, dateTo = null } = {}) {
  const artists = getArtists();

  if (!artists.length) {
    console.log('⚠️  No artists tracked.');
    return [];
  }

  const includeGroups = resolveIncludeGroups(releaseType);
  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(dateTo) : null;

  console.log(`🎤 Fetching catalog for ${artists.length} artist(s)...`);
  console.log(`   Type: ${releaseType} | From: ${dateFrom || 'any'} | To: ${dateTo || 'any'}\n`);

  const allTracks = [];

  for (const artist of artists) {
    try {
      console.log(`  🔍 ${artist.name}...`);
      const albums = await getArtistAlbums(artist.id, { includeGroups });

      const filtered = albums.filter((album) => {
        if (!fromDate && !toDate) return true;
        const rd = parseReleaseDate(album.release_date, album.release_date_precision);
        if (fromDate && rd < fromDate) return false;
        if (toDate && rd > toDate) return false;
        return true;
      });

      console.log(`     ${filtered.length} release(s) match filters (of ${albums.length} total):`);

      for (const album of filtered) {
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

module.exports = { scanForNewReleases, scanFullCatalog, parseReleaseDate };
