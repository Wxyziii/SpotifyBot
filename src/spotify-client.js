const SpotifyWebApi = require('spotify-web-api-node');
const { config } = require('./config');
const { loadTokens, saveTokens } = require('./store');

let api = null;
let tokenExpiresAt = 0;

function createApi() {
  return new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
}

function getApi() {
  if (!api) {
    api = createApi();
    const tokens = loadTokens();
    if (tokens) {
      api.setAccessToken(tokens.accessToken);
      api.setRefreshToken(tokens.refreshToken);
      tokenExpiresAt = tokens.expiresAt || 0;
    }
  }
  return api;
}

async function ensureAccessToken() {
  const spotifyApi = getApi();
  const now = Date.now();

  if (now >= tokenExpiresAt - 5 * 60 * 1000) {
    console.log('🔄 Refreshing access token...');
    try {
      const data = await spotifyApi.refreshAccessToken();
      const { access_token, expires_in, refresh_token } = data.body;

      spotifyApi.setAccessToken(access_token);
      if (refresh_token) spotifyApi.setRefreshToken(refresh_token);

      const newExpiresAt = Date.now() + expires_in * 1000;
      tokenExpiresAt = newExpiresAt;

      saveTokens({
        accessToken: access_token,
        refreshToken: refresh_token || spotifyApi.getRefreshToken(),
        expiresAt: newExpiresAt,
      });

      console.log('✅ Access token refreshed.');
    } catch (err) {
      console.error('❌ Failed to refresh access token:', err.message);
      throw err;
    }
  }

  return spotifyApi;
}

async function withRetry(fn, label = 'API call') {
  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.statusCode || err.status;

      if (status === 429) {
        const retryAfter = (parseInt(err.headers?.['retry-after'], 10) || 5) * 1000;
        console.warn(`⏳ Rate limited on "${label}". Retrying in ${retryAfter / 1000}s...`);
        await sleep(retryAfter);
        continue;
      }

      if (attempt < config.retryAttempts) {
        const delay = config.retryDelayMs * attempt;
        console.warn(`⚠️  "${label}" attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        console.error(`❌ "${label}" failed after ${config.retryAttempts} attempts: ${err.message}`);
        throw err;
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- High-level API helpers ---

async function searchArtists(query, limit = 10) {
  const spotifyApi = await ensureAccessToken();
  const result = await withRetry(
    () => spotifyApi.searchArtists(query, { limit }),
    `searchArtists("${query}")`
  );
  return result.body.artists.items;
}

async function getFollowedArtists() {
  const spotifyApi = await ensureAccessToken();
  const artists = [];
  let after = null;

  while (true) {
    const opts = { limit: 50 };
    if (after) opts.after = after;

    const result = await withRetry(
      () => spotifyApi.getFollowedArtists(opts),
      `getFollowedArtists(after=${after})`
    );

    const items = result.body.artists.items;
    artists.push(...items);

    const cursor = result.body.artists.cursors;
    if (cursor && cursor.after) {
      after = cursor.after;
    } else {
      break;
    }
  }

  return artists;
}

async function getUserPlaylists() {
  const spotifyApi = await ensureAccessToken();
  const playlists = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const result = await withRetry(
      () => spotifyApi.getUserPlaylists({ limit: 50, offset }),
      `getUserPlaylists(offset=${offset})`
    );

    playlists.push(...result.body.items);
    total = result.body.total;
    offset += 50;
  }

  return playlists;
}

async function getArtistAlbums(artistId, { includeGroups = 'album,single', limit = 50 } = {}) {
  const spotifyApi = await ensureAccessToken();
  const albums = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const result = await withRetry(
      () =>
        spotifyApi.getArtistAlbums(artistId, {
          include_groups: includeGroups,
          limit,
          offset,
          market: 'US',
        }),
      `getArtistAlbums(${artistId}, offset=${offset})`
    );

    albums.push(...result.body.items);
    total = result.body.total;
    offset += limit;
  }

  return albums;
}

async function getAlbumTracks(albumId, { limit = 50 } = {}) {
  const spotifyApi = await ensureAccessToken();
  const tracks = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const result = await withRetry(
      () => spotifyApi.getAlbumTracks(albumId, { limit, offset }),
      `getAlbumTracks(${albumId}, offset=${offset})`
    );

    tracks.push(...result.body.items);
    total = result.body.total;
    offset += limit;
  }

  return tracks;
}

async function getPlaylistTracks(playlistId) {
  const spotifyApi = await ensureAccessToken();
  const tracks = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const result = await withRetry(
      () => spotifyApi.getPlaylistTracks(playlistId, { limit: 100, offset }),
      `getPlaylistTracks(${playlistId}, offset=${offset})`
    );

    tracks.push(...result.body.items);
    total = result.body.total;
    offset += 100;
  }

  return tracks;
}

async function addTracksToPlaylist(playlistId, uris) {
  const spotifyApi = await ensureAccessToken();

  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await withRetry(
      () => spotifyApi.addTracksToPlaylist(playlistId, batch),
      `addTracksToPlaylist(batch ${Math.floor(i / 100) + 1})`
    );
  }
}

async function replacePlaylistTracks(playlistId, uris) {
  const spotifyApi = await ensureAccessToken();

  // First call replaces (clears + sets first 100)
  const first = uris.slice(0, 100);
  await withRetry(
    () => spotifyApi.replaceTracksInPlaylist(playlistId, first),
    'replacePlaylistTracks(initial)'
  );

  // Append remaining in batches of 100
  for (let i = 100; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await withRetry(
      () => spotifyApi.addTracksToPlaylist(playlistId, batch),
      `replacePlaylistTracks(batch ${Math.floor(i / 100) + 1})`
    );
  }
}

module.exports = {
  createApi,
  getApi,
  ensureAccessToken,
  searchArtists,
  getFollowedArtists,
  getUserPlaylists,
  getArtistAlbums,
  getAlbumTracks,
  getPlaylistTracks,
  addTracksToPlaylist,
  replacePlaylistTracks,
};
