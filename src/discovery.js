/**
 * Discovery Playlist Generator - Hybrid Algorithm
 * 
 * Combines multiple data sources to create personalized discovery playlists:
 * 1. User taste profile (top artists, genres, popularity preferences)
 * 2. Genre-based artist search
 * 3. New releases filtering
 * 4. Scoring algorithm to rank discovery candidates
 */

const {
  getMyTopArtists,
  getMyTopTracks,
  getArtistTopTracks,
  searchByGenre,
  getNewReleases,
  getMySavedTracks,
  getMultipleArtists,
  getFollowedArtists,
  createPlaylist,
  addTracksToPlaylist,
  getPlaylistTracks,
  getArtist,
  getAlbumTracks,
} = require('./spotify-client');
const { getArtists } = require('./store');

const TIME_RANGES = {
  short: 'short_term',
  medium: 'medium_term',
  long: 'long_term',
};

const DISCOVERY_LEVELS = {
  familiar: { familiar: 0.8, discovery: 0.2, label: 'Mostly familiar (80/20)' },
  balanced: { familiar: 0.5, discovery: 0.5, label: 'Balanced (50/50)' },
  explore: { familiar: 0.2, discovery: 0.8, label: 'Explore mode (20/80)' },
};

const PLAYLIST_SIZES = {
  small: { count: 30, label: '30 tracks (~1.5 hours)' },
  medium: { count: 50, label: '50 tracks (~2.5 hours)' },
  large: { count: 100, label: '100 tracks (~5 hours)' },
};

// ============================================================================
// STEP 1: Build User Taste Profile
// ============================================================================

async function buildTasteProfile(timeRange = 'medium_term') {
  console.log('  📊 Building your taste profile...\n');
  
  // Get top artists from multiple time ranges for better coverage
  const [shortTermArtists, mediumTermArtists, longTermArtists] = await Promise.all([
    getMyTopArtists('short_term', 20).catch(() => []),
    getMyTopArtists('medium_term', 30).catch(() => []),
    getMyTopArtists('long_term', 20).catch(() => []),
  ]);
  
  // Combine and dedupe artists
  const artistMap = new Map();
  const addArtists = (artists, weight) => {
    for (const artist of artists) {
      if (!artistMap.has(artist.id)) {
        artistMap.set(artist.id, { ...artist, weight });
      } else {
        artistMap.get(artist.id).weight += weight;
      }
    }
  };
  
  addArtists(shortTermArtists, 3);  // Recent listening weighted higher
  addArtists(mediumTermArtists, 2);
  addArtists(longTermArtists, 1);
  
  const allTopArtists = [...artistMap.values()].sort((a, b) => b.weight - a.weight);
  
  // Extract and rank genres
  const genreScores = {};
  for (const artist of allTopArtists) {
    for (const genre of artist.genres || []) {
      genreScores[genre] = (genreScores[genre] || 0) + artist.weight;
    }
  }
  
  const topGenres = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre]) => genre);
  
  // Calculate average popularity preference
  const popularities = allTopArtists.map(a => a.popularity).filter(p => p > 0);
  const avgPopularity = popularities.length > 0 
    ? popularities.reduce((a, b) => a + b, 0) / popularities.length 
    : 50;
  
  // Get followed artists to exclude from discovery
  let followedIds = new Set();
  try {
    const followed = await getFollowedArtists();
    followedIds = new Set(followed.map(a => a.id));
  } catch (e) {
    // Ignore if we can't get followed artists
  }
  
  // Add top artists to exclusion set
  const knownArtistIds = new Set([...followedIds, ...allTopArtists.map(a => a.id)]);
  
  console.log(`     ✓ Found ${allTopArtists.length} top artists`);
  console.log(`     ✓ Top genres: ${topGenres.slice(0, 3).join(', ')}`);
  console.log(`     ✓ Popularity preference: ~${Math.round(avgPopularity)}/100`);
  
  return {
    topArtists: allTopArtists,
    topGenres,
    avgPopularity,
    knownArtistIds,
    followedIds,
  };
}

// ============================================================================
// STEP 2: Find Discovery Candidates
// ============================================================================

async function findDiscoveryCandidates(profile, maxCandidates = 100) {
  console.log('\n  🔍 Searching for new artists...\n');
  
  const candidates = new Map(); // artistId -> { artist, score, source }
  
  // Search by top genres
  const genresToSearch = profile.topGenres.slice(0, 5);
  
  for (const genre of genresToSearch) {
    try {
      console.log(`     → Searching genre: "${genre}"`);
      const result = await searchByGenre(genre, 'artist', 30);
      const artists = result.artists?.items || [];
      
      for (const artist of artists) {
        if (!profile.knownArtistIds.has(artist.id) && !candidates.has(artist.id)) {
          candidates.set(artist.id, {
            artist,
            sources: ['genre_search'],
            genreMatch: genre,
          });
        } else if (candidates.has(artist.id)) {
          // Artist found in multiple genre searches - boost it
          candidates.get(artist.id).sources.push('genre_search');
        }
      }
    } catch (e) {
      console.log(`     ⚠️  Could not search genre "${genre}"`);
    }
  }
  
  console.log(`     ✓ Found ${candidates.size} candidates from genre search`);
  
  // Get new releases and filter by genre
  try {
    console.log(`     → Checking new releases...`);
    const newReleases = await getNewReleases(50);
    
    // Get unique artist IDs from new releases
    const newReleaseArtistIds = [...new Set(
      newReleases.flatMap(album => album.artists.map(a => a.id))
    )].filter(id => !profile.knownArtistIds.has(id));
    
    // Fetch full artist data to check genres
    if (newReleaseArtistIds.length > 0) {
      const artistDetails = await getMultipleArtists(newReleaseArtistIds.slice(0, 50));
      
      for (const artist of artistDetails) {
        const artistGenres = artist.genres || [];
        const genreOverlap = artistGenres.filter(g => 
          profile.topGenres.some(tg => g.includes(tg) || tg.includes(g))
        );
        
        if (genreOverlap.length > 0) {
          if (!candidates.has(artist.id)) {
            candidates.set(artist.id, {
              artist,
              sources: ['new_release'],
              genreMatch: genreOverlap[0],
              isNewRelease: true,
            });
          } else {
            candidates.get(artist.id).sources.push('new_release');
            candidates.get(artist.id).isNewRelease = true;
          }
        }
      }
    }
    
    console.log(`     ✓ Added artists from new releases`);
  } catch (e) {
    console.log(`     ⚠️  Could not fetch new releases`);
  }
  
  console.log(`     ✓ Total candidates: ${candidates.size}`);
  
  return candidates;
}

// ============================================================================
// STEP 3: Score and Rank Artists
// ============================================================================

function scoreAndRankArtists(candidates, profile) {
  console.log('\n  📈 Scoring discovery candidates...\n');
  
  const scored = [];
  
  for (const [artistId, data] of candidates) {
    const artist = data.artist;
    let score = 0;
    const reasons = [];
    
    // Genre overlap score (0-35 points)
    const artistGenres = artist.genres || [];
    const genreOverlap = artistGenres.filter(g => 
      profile.topGenres.some(tg => 
        g.toLowerCase().includes(tg.toLowerCase()) || 
        tg.toLowerCase().includes(g.toLowerCase())
      )
    );
    const genreScore = Math.min(genreOverlap.length * 12, 35);
    score += genreScore;
    if (genreScore > 0) reasons.push(`genre match (${genreOverlap.length})`);
    
    // Popularity similarity score (0-25 points)
    // Prefer artists within ±20 of user's preference
    const popDiff = Math.abs(artist.popularity - profile.avgPopularity);
    const popScore = Math.max(0, 25 - popDiff);
    score += popScore;
    if (popScore > 15) reasons.push('similar popularity');
    
    // New release bonus (0-20 points)
    if (data.isNewRelease) {
      score += 20;
      reasons.push('new release');
    }
    
    // Multiple source bonus (0-15 points)
    if (data.sources.length > 1) {
      score += data.sources.length * 5;
      reasons.push('multi-source');
    }
    
    // Follower count score (0-5 points)
    // Slight bonus for artists with decent following (not too obscure)
    const followers = artist.followers?.total || 0;
    if (followers > 10000 && followers < 5000000) {
      score += 5;
    }
    
    scored.push({
      artist,
      score,
      reasons,
      sources: data.sources,
      genreMatch: data.genreMatch,
    });
  }
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Log top candidates
  console.log('     Top discovery candidates:');
  scored.slice(0, 5).forEach((item, i) => {
    console.log(`       ${i + 1}. ${item.artist.name} (score: ${item.score})`);
  });
  
  return scored;
}

// ============================================================================
// STEP 4: Get Tracks from Ranked Artists
// ============================================================================

async function getTracksFromArtists(rankedArtists, profile, targetCount) {
  console.log('\n  🎵 Fetching tracks from discovery artists...\n');
  
  const familiarTracks = [];
  const discoveryTracks = [];
  const seenTrackIds = new Set();
  
  // Get tracks from user's top artists (familiar)
  console.log('     → Getting tracks from your top artists...');
  for (const artist of profile.topArtists.slice(0, 10)) {
    try {
      const tracks = await getArtistTopTracks(artist.id);
      for (const track of tracks.slice(0, 5)) {
        if (!seenTrackIds.has(track.id)) {
          seenTrackIds.add(track.id);
          track._source = 'familiar';
          track._artistName = artist.name;
          familiarTracks.push(track);
        }
      }
    } catch (e) {
      // Skip on error
    }
  }
  console.log(`     ✓ ${familiarTracks.length} familiar tracks`);
  
  // Get tracks from discovery artists
  console.log('     → Getting tracks from discovery artists...');
  const artistsToFetch = rankedArtists.slice(0, 25);
  
  for (const item of artistsToFetch) {
    try {
      const tracks = await getArtistTopTracks(item.artist.id);
      for (const track of tracks.slice(0, 4)) {
        if (!seenTrackIds.has(track.id)) {
          seenTrackIds.add(track.id);
          track._source = 'discovery';
          track._artistName = item.artist.name;
          track._score = item.score;
          discoveryTracks.push(track);
        }
      }
    } catch (e) {
      // Skip on error
    }
    
    if (discoveryTracks.length >= targetCount) break;
  }
  console.log(`     ✓ ${discoveryTracks.length} discovery tracks`);
  
  return { familiarTracks, discoveryTracks };
}

// ============================================================================
// STEP 5: Balance and Create Playlist
// ============================================================================

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function filterExistingTracks(tracks, playlistId) {
  if (!playlistId) return tracks;
  
  try {
    const existingItems = await getPlaylistTracks(playlistId);
    const existingUris = new Set(
      existingItems.filter(item => item.track).map(item => item.track.uri)
    );
    return tracks.filter(t => !existingUris.has(t.uri));
  } catch (e) {
    return tracks;
  }
}

function balancePlaylist(familiarTracks, discoveryTracks, discoveryLevel, targetCount) {
  const { familiar: familiarRatio, discovery: discoveryRatio } = 
    DISCOVERY_LEVELS[discoveryLevel] || DISCOVERY_LEVELS.balanced;
  
  const familiarCount = Math.floor(targetCount * familiarRatio);
  const discoveryCount = targetCount - familiarCount;
  
  shuffleArray(familiarTracks);
  shuffleArray(discoveryTracks);
  
  const selectedFamiliar = familiarTracks.slice(0, familiarCount);
  const selectedDiscovery = discoveryTracks.slice(0, discoveryCount);
  
  let result = [...selectedFamiliar, ...selectedDiscovery];
  
  // Fill if needed
  if (result.length < targetCount) {
    const remaining = targetCount - result.length;
    const selectedIds = new Set(result.map(t => t.id));
    const extras = [...familiarTracks, ...discoveryTracks]
      .filter(t => !selectedIds.has(t.id))
      .slice(0, remaining);
    result = [...result, ...extras];
  }
  
  return {
    tracks: shuffleArray(result),
    stats: {
      familiar: selectedFamiliar.length,
      discovery: selectedDiscovery.length,
    },
  };
}

function getNewArtistsFromTracks(tracks) {
  const artists = new Map();
  for (const track of tracks) {
    if (track._source === 'discovery') {
      const artistName = track._artistName || track.artists?.[0]?.name;
      const artistId = track.artists?.[0]?.id;
      if (artistId && !artists.has(artistId)) {
        artists.set(artistId, artistName);
      }
    }
  }
  return [...artists.values()];
}

function generatePlaylistName(genres) {
  const date = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  
  if (genres.length > 0) {
    const genreName = genres[0]
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `Discover - ${genreName} - ${dateStr}`;
  }
  
  return `Discover - ${dateStr}`;
}

// ============================================================================
// MAIN: Generate Discovery Playlist
// ============================================================================

async function generateDiscoveryPlaylist(options = {}) {
  const {
    seedSource = 'top',
    timeRange = 'medium_term',
    discoveryLevel = 'balanced',
    playlistSize = 'medium',
    excludePlaylistId = null,
  } = options;
  
  const targetCount = PLAYLIST_SIZES[playlistSize]?.count || 50;
  
  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║       🧠 Hybrid Discovery Algorithm v2.0         ║');
  console.log('  ╚══════════════════════════════════════════════════╝\n');
  
  // STEP 1: Build taste profile
  let profile;
  if (seedSource === 'tracked') {
    // Use tracked artists instead of top artists
    const trackedArtists = getArtists();
    if (!trackedArtists.length) {
      throw new Error('No tracked artists. Add some artists first.');
    }
    
    console.log('  📊 Building profile from tracked artists...\n');
    const artistDetails = [];
    for (const a of trackedArtists.slice(0, 15)) {
      try {
        const full = await getArtist(a.id);
        artistDetails.push({ ...full, weight: 2 });
      } catch (e) {}
    }
    
    const genreScores = {};
    for (const artist of artistDetails) {
      for (const genre of artist.genres || []) {
        genreScores[genre] = (genreScores[genre] || 0) + artist.weight;
      }
    }
    
    const topGenres = Object.entries(genreScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre]) => genre);
    
    const popularities = artistDetails.map(a => a.popularity).filter(p => p > 0);
    const avgPopularity = popularities.length > 0 
      ? popularities.reduce((a, b) => a + b, 0) / popularities.length 
      : 50;
    
    profile = {
      topArtists: artistDetails,
      topGenres,
      avgPopularity,
      knownArtistIds: new Set(artistDetails.map(a => a.id)),
      followedIds: new Set(),
    };
    
    console.log(`     ✓ Using ${artistDetails.length} tracked artists`);
    console.log(`     ✓ Top genres: ${topGenres.slice(0, 3).join(', ')}`);
  } else {
    profile = await buildTasteProfile(timeRange);
  }
  
  // Show seed artists
  console.log('\n  📊 Your seed artists:');
  profile.topArtists.slice(0, 5).forEach((a, i) => {
    console.log(`     ${i + 1}. ${a.name}`);
  });
  
  if (profile.topGenres.length) {
    console.log(`\n  🎵 Top genres: ${profile.topGenres.slice(0, 3).join(', ')}`);
  }
  
  // STEP 2: Find discovery candidates
  const candidates = await findDiscoveryCandidates(profile);
  
  if (candidates.size === 0) {
    throw new Error('No discovery candidates found. Try different settings.');
  }
  
  // STEP 3: Score and rank
  const rankedArtists = scoreAndRankArtists(candidates, profile);
  
  // STEP 4: Get tracks
  const { familiarTracks, discoveryTracks } = await getTracksFromArtists(
    rankedArtists,
    profile,
    targetCount * 2
  );
  
  // Filter out existing tracks
  const filteredFamiliar = await filterExistingTracks(familiarTracks, excludePlaylistId);
  const filteredDiscovery = await filterExistingTracks(discoveryTracks, excludePlaylistId);
  
  // STEP 5: Balance and create playlist
  const { tracks: finalTracks, stats } = balancePlaylist(
    filteredFamiliar,
    filteredDiscovery,
    discoveryLevel,
    targetCount
  );
  
  if (finalTracks.length === 0) {
    throw new Error('No tracks available for playlist.');
  }
  
  console.log(`\n  ✓ Selected ${finalTracks.length} tracks (${stats.familiar} familiar, ${stats.discovery} discovery)`);
  
  // Get new artists to highlight
  const newArtists = getNewArtistsFromTracks(finalTracks);
  
  // Create playlist
  const playlistName = generatePlaylistName(profile.topGenres);
  console.log(`\n  📝 Creating playlist: "${playlistName}"`);
  
  const playlist = await createPlaylist(
    playlistName,
    `Generated by SpotifyBot Hybrid Algorithm - ${stats.familiar} familiar + ${stats.discovery} discovery`,
    false
  );
  
  // Add tracks
  const trackUris = finalTracks.map(t => t.uri);
  await addTracksToPlaylist(playlist.id, trackUris);
  
  console.log(`  ✅ Done! Added ${trackUris.length} tracks.`);
  
  return {
    playlist,
    trackCount: trackUris.length,
    stats,
    newArtists: newArtists.slice(0, 10),
    genres: profile.topGenres.slice(0, 3),
  };
}

module.exports = {
  generateDiscoveryPlaylist,
  buildTasteProfile,
  TIME_RANGES,
  DISCOVERY_LEVELS,
  PLAYLIST_SIZES,
};
