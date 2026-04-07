# Spotify Web API Reference (Updated April 2026)

This document lists all Spotify Web API endpoints, their status, and usage information.

---

## ⚠️ Important: API Changes (November 2024)

On November 27, 2024, Spotify deprecated several endpoints for **new applications** and apps still in development mode. Apps with existing "extended mode" access retain functionality.

### Deprecated Endpoints (Return 404 for New Apps)

| Endpoint | Description | Status |
|----------|-------------|--------|
| `GET /recommendations` | Get track recommendations based on seeds | ❌ **DEPRECATED** |
| `GET /recommendations/available-genre-seeds` | Get available genre seeds | ❌ **DEPRECATED** |
| `GET /artists/{id}/related-artists` | Get related artists | ❌ **DEPRECATED** |
| `GET /audio-features/{id}` | Get audio features for a track | ❌ **DEPRECATED** |
| `GET /audio-features` | Get audio features for multiple tracks | ❌ **DEPRECATED** |
| `GET /audio-analysis/{id}` | Get audio analysis for a track | ❌ **DEPRECATED** |
| `GET /browse/featured-playlists` | Get featured playlists | ❌ **DEPRECATED** |
| `GET /browse/categories/{id}/playlists` | Get category playlists | ❌ **DEPRECATED** |
| 30-second preview URLs | Preview URLs in track responses | ❌ **DEPRECATED** |

---

## ✅ Working Endpoints

### Albums

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/albums/{id}` | GET | Get an album | No (public) |
| `/albums` | GET | Get multiple albums | No (public) |
| `/albums/{id}/tracks` | GET | Get album tracks | No (public) |
| `/me/albums` | GET | Get user's saved albums | Yes (`user-library-read`) |
| `/me/albums` | PUT | Save albums for user | Yes (`user-library-modify`) |
| `/me/albums` | DELETE | Remove saved albums | Yes (`user-library-modify`) |
| `/me/albums/contains` | GET | Check saved albums | Yes (`user-library-read`) |
| `/browse/new-releases` | GET | Get new releases | No (public) |

### Artists

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/artists/{id}` | GET | Get an artist | No (public) |
| `/artists` | GET | Get multiple artists | No (public) |
| `/artists/{id}/albums` | GET | Get artist's albums | No (public) |
| `/artists/{id}/top-tracks` | GET | Get artist's top tracks | No (public) |

**Note:** `GET /artists/{id}/related-artists` is **DEPRECATED** for new apps.

### Tracks

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/tracks/{id}` | GET | Get a track | No (public) |
| `/tracks` | GET | Get multiple tracks | No (public) |
| `/me/tracks` | GET | Get user's saved tracks | Yes (`user-library-read`) |
| `/me/tracks` | PUT | Save tracks for user | Yes (`user-library-modify`) |
| `/me/tracks` | DELETE | Remove saved tracks | Yes (`user-library-modify`) |
| `/me/tracks/contains` | GET | Check saved tracks | Yes (`user-library-read`) |

### Search

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/search` | GET | Search for items | No (public) |

**Query Parameters:**
- `q` - Search query (required)
- `type` - Types to search: `album`, `artist`, `playlist`, `track`, `show`, `episode`, `audiobook`
- `market` - ISO 3166-1 alpha-2 country code
- `limit` - Maximum results (1-50, default 20)
- `offset` - Index of first result
- `include_external` - Include external audio content

**Example:**
```
GET /search?q=polish+rap&type=artist,track&limit=10
```

### Playlists

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/playlists/{id}` | GET | Get a playlist | No (public playlists) |
| `/playlists/{id}` | PUT | Update playlist details | Yes (`playlist-modify-*`) |
| `/playlists/{id}/tracks` | GET | Get playlist tracks | No (public playlists) |
| `/playlists/{id}/tracks` | POST | Add tracks to playlist | Yes (`playlist-modify-*`) |
| `/playlists/{id}/tracks` | PUT | Replace playlist tracks | Yes (`playlist-modify-*`) |
| `/playlists/{id}/tracks` | DELETE | Remove tracks from playlist | Yes (`playlist-modify-*`) |
| `/users/{user_id}/playlists` | GET | Get user's playlists | Yes (`playlist-read-*`) |
| `/users/{user_id}/playlists` | POST | Create a playlist | Yes (`playlist-modify-*`) |
| `/me/playlists` | GET | Get current user's playlists | Yes (`playlist-read-private`) |
| `/playlists/{id}/images` | GET | Get playlist cover image | No (public playlists) |
| `/playlists/{id}/images` | PUT | Upload playlist cover image | Yes (`ugc-image-upload`) |

### User Profile

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/me` | GET | Get current user's profile | Yes (any scope) |
| `/users/{user_id}` | GET | Get a user's profile | No (public) |
| `/me/top/artists` | GET | Get user's top artists | Yes (`user-top-read`) |
| `/me/top/tracks` | GET | Get user's top tracks | Yes (`user-top-read`) |

**Top Items Parameters:**
- `time_range`: `short_term` (~4 weeks), `medium_term` (~6 months), `long_term` (all time)
- `limit`: 1-50 (default 20)
- `offset`: Pagination offset

### Follow

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/me/following` | GET | Get followed artists | Yes (`user-follow-read`) |
| `/me/following` | PUT | Follow artists/users | Yes (`user-follow-modify`) |
| `/me/following` | DELETE | Unfollow artists/users | Yes (`user-follow-modify`) |
| `/me/following/contains` | GET | Check if following | Yes (`user-follow-read`) |
| `/playlists/{id}/followers` | PUT | Follow a playlist | Yes (`playlist-modify-*`) |
| `/playlists/{id}/followers` | DELETE | Unfollow a playlist | Yes (`playlist-modify-*`) |
| `/playlists/{id}/followers/contains` | GET | Check playlist followers | Yes (`playlist-read-private`) |

### Player (Requires Premium)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/me/player` | GET | Get playback state | Yes (`user-read-playback-state`) |
| `/me/player` | PUT | Transfer playback | Yes (`user-modify-playback-state`) |
| `/me/player/devices` | GET | Get available devices | Yes (`user-read-playback-state`) |
| `/me/player/currently-playing` | GET | Get currently playing | Yes (`user-read-currently-playing`) |
| `/me/player/play` | PUT | Start/resume playback | Yes (`user-modify-playback-state`) |
| `/me/player/pause` | PUT | Pause playback | Yes (`user-modify-playback-state`) |
| `/me/player/next` | POST | Skip to next track | Yes (`user-modify-playback-state`) |
| `/me/player/previous` | POST | Skip to previous track | Yes (`user-modify-playback-state`) |
| `/me/player/seek` | PUT | Seek to position | Yes (`user-modify-playback-state`) |
| `/me/player/repeat` | PUT | Set repeat mode | Yes (`user-modify-playback-state`) |
| `/me/player/volume` | PUT | Set volume | Yes (`user-modify-playback-state`) |
| `/me/player/shuffle` | PUT | Toggle shuffle | Yes (`user-modify-playback-state`) |
| `/me/player/recently-played` | GET | Get recently played | Yes (`user-read-recently-played`) |
| `/me/player/queue` | GET | Get queue | Yes (`user-read-playback-state`) |
| `/me/player/queue` | POST | Add to queue | Yes (`user-modify-playback-state`) |

### Shows (Podcasts)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/shows/{id}` | GET | Get a show | No (public) |
| `/shows` | GET | Get multiple shows | No (public) |
| `/shows/{id}/episodes` | GET | Get show episodes | No (public) |
| `/me/shows` | GET | Get user's saved shows | Yes (`user-library-read`) |
| `/me/shows` | PUT | Save shows for user | Yes (`user-library-modify`) |
| `/me/shows` | DELETE | Remove saved shows | Yes (`user-library-modify`) |
| `/me/shows/contains` | GET | Check saved shows | Yes (`user-library-read`) |

### Episodes

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/episodes/{id}` | GET | Get an episode | No (public) |
| `/episodes` | GET | Get multiple episodes | No (public) |
| `/me/episodes` | GET | Get saved episodes | Yes (`user-library-read`) |
| `/me/episodes` | PUT | Save episodes | Yes (`user-library-modify`) |
| `/me/episodes` | DELETE | Remove saved episodes | Yes (`user-library-modify`) |
| `/me/episodes/contains` | GET | Check saved episodes | Yes (`user-library-read`) |

### Audiobooks

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/audiobooks/{id}` | GET | Get an audiobook | No (public) |
| `/audiobooks` | GET | Get multiple audiobooks | No (public) |
| `/audiobooks/{id}/chapters` | GET | Get audiobook chapters | No (public) |
| `/me/audiobooks` | GET | Get saved audiobooks | Yes (`user-library-read`) |
| `/me/audiobooks` | PUT | Save audiobooks | Yes (`user-library-modify`) |
| `/me/audiobooks` | DELETE | Remove saved audiobooks | Yes (`user-library-modify`) |
| `/me/audiobooks/contains` | GET | Check saved audiobooks | Yes (`user-library-read`) |

### Chapters

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/chapters/{id}` | GET | Get a chapter | No (public) |
| `/chapters` | GET | Get multiple chapters | No (public) |

### Categories

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/browse/categories` | GET | Get browse categories | No (public) |
| `/browse/categories/{id}` | GET | Get a single category | No (public) |

**Note:** `GET /browse/categories/{id}/playlists` is **DEPRECATED**.

### Markets

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/markets` | GET | Get available markets | No (public) |

---

## OAuth Scopes

### Images
- `ugc-image-upload` - Upload images to Spotify

### Spotify Connect
- `user-read-playback-state` - Read playback state
- `user-modify-playback-state` - Control playback
- `user-read-currently-playing` - Read currently playing

### Playback
- `app-remote-control` - Control Spotify on devices
- `streaming` - Stream content (Web Playback SDK)

### Playlists
- `playlist-read-private` - Read private playlists
- `playlist-read-collaborative` - Read collaborative playlists
- `playlist-modify-private` - Modify private playlists
- `playlist-modify-public` - Modify public playlists

### Follow
- `user-follow-modify` - Follow/unfollow artists
- `user-follow-read` - Read followed artists

### Listening History
- `user-read-playback-position` - Read playback position
- `user-top-read` - Read top artists/tracks
- `user-read-recently-played` - Read recently played

### Library
- `user-library-modify` - Modify library
- `user-library-read` - Read library

### Users
- `user-read-email` - Read email address
- `user-read-private` - Read private profile info

---

## Alternatives for Deprecated Endpoints

Since the Recommendations and Related Artists APIs are deprecated, here are working alternatives:

### For Music Discovery

1. **Use Search API with genre filters:**
   ```
   GET /search?q=genre:"polish hip hop"&type=artist&limit=50
   ```

2. **Get artist's top tracks:**
   ```
   GET /artists/{id}/top-tracks?market=US
   ```

3. **Browse new releases:**
   ```
   GET /browse/new-releases?limit=50
   ```

4. **Use user's top artists/tracks as seeds:**
   ```
   GET /me/top/artists?time_range=medium_term&limit=20
   GET /me/top/tracks?time_range=medium_term&limit=50
   ```

5. **Explore artist's albums for deeper catalog:**
   ```
   GET /artists/{id}/albums?include_groups=album,single&limit=50
   GET /albums/{id}/tracks
   ```

### Workflow for Discovery Playlist

```
1. GET /me/top/artists → Get user's favorite artists
2. For each artist: GET /artists/{id}/top-tracks → Get their best songs
3. Use Search API to find similar artists by genre
4. Create playlist: POST /users/{user_id}/playlists
5. Add tracks: POST /playlists/{id}/tracks
```

---

## Rate Limits

Spotify implements rate limiting to prevent abuse:

- Returns `429 Too Many Requests` when limit exceeded
- Check `Retry-After` header for wait time (in seconds)
- Implement exponential backoff for retries

**Best Practices:**
- Cache responses when possible
- Batch requests (e.g., get multiple artists in one call)
- Use pagination efficiently
- Don't make unnecessary repeated calls

---

## Base URL

All endpoints use:
```
https://api.spotify.com/v1
```

---

## Authentication

Spotify uses OAuth 2.0:

1. **Authorization Code Flow** (recommended for server-side apps)
   - User grants permission via browser
   - Exchange code for access + refresh tokens
   - Refresh token when expired

2. **Client Credentials Flow** (for public data only)
   - No user authentication
   - Only access public endpoints

**Token endpoint:** `https://accounts.spotify.com/api/token`
**Authorize endpoint:** `https://accounts.spotify.com/authorize`

---

## Resources

- [Official Documentation](https://developer.spotify.com/documentation/web-api)
- [API Reference](https://developer.spotify.com/documentation/web-api/reference)
- [Developer Dashboard](https://developer.spotify.com/dashboard)
- [Community Forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)

---

*Last updated: April 2026*
