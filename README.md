# 🎵 Spotify Release Bot

Automatically detects new releases from your favorite artists and adds them to a Spotify playlist. Runs 24/7 as a background process — no manual action required after setup.

## Features

- Tracks only artists you manually select
- Scans every 12 hours (configurable)
- Detects new albums and singles
- Adds new tracks to your target playlist
- Skips duplicates automatically
- Handles pagination, rate limits, and retries
- Runs unattended with PM2

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- A **Spotify account** (free or premium)

---

## Setup

### 1. Create a Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:
   - **App name**: `Release Bot` (or anything you like)
   - **App description**: Anything
   - **Redirect URI**: `http://192.168.1.7:8888/callback`
4. Check the **Web API** checkbox
5. Click **Save**
6. Note your **Client ID** and **Client Secret**

### 2. Get Your Playlist ID

1. Open Spotify and navigate to the playlist you want tracks added to (or create a new one)
2. Click **Share → Copy link to playlist**
3. The URL looks like: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
4. The playlist ID is the part after `/playlist/`: `37i9dQZF1DXcBWIGoYBM5M`

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://192.168.1.7:8888/callback
TARGET_PLAYLIST_ID=your_playlist_id_here
SCAN_INTERVAL_HOURS=12
AUTH_PORT=8888
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Authenticate with Spotify

```bash
npm run auth
```

This opens your browser for Spotify login. After authorizing, tokens are saved locally. You only need to do this **once**.

### 6. Add Artists to Track

```bash
npm run add-artist "Radiohead"
npm run add-artist "Kendrick Lamar"
npm run add-artist "Billie Eilish"
```

Each command searches Spotify and lets you select the correct artist from the results.

### 7. Add All Songs from Tracked Artists (Optional)

```bash
npm run add-all
```

This performs a **one-time bulk import** of every album, single, and track from all your tracked artists into the target playlist. Duplicates are skipped automatically. Useful for backfilling a playlist before letting the bot handle new releases going forward.

### 8. Start the Bot

```bash
npm start
```

The bot will:
1. Run an immediate scan
2. Schedule automatic scans every 12 hours
3. Add any new tracks to your playlist

---

## Running with PM2 (Recommended for Production)

PM2 keeps the bot running 24/7, restarts it on crash, and can start it on system boot.

### Install PM2

```bash
npm install -g pm2
```

### Start the Bot with PM2

```bash
pm2 start src/index.js --name spotify-bot
```

### Useful PM2 Commands

```bash
# View logs
pm2 logs spotify-bot

# Check status
pm2 status

# Restart
pm2 restart spotify-bot

# Stop
pm2 stop spotify-bot

# Remove from PM2
pm2 delete spotify-bot
```

### Auto-Start on System Boot

```bash
pm2 startup
# Follow the instructions it prints, then:
pm2 save
```

Now the bot will automatically restart if the server reboots.

---

## Project Structure

```
spotify-bot/
├── package.json
├── .env.example
├── .env                    # Your config (git-ignored)
├── .gitignore
├── README.md
├── data/
│   ├── store.json          # Artists & lastChecked (git-ignored)
│   └── tokens.json         # Auth tokens (git-ignored)
└── src/
    ├── index.js            # Main entry point
    ├── auth.js             # Spotify OAuth flow
    ├── add-artist.js       # CLI: add artist command
    ├── add-all.js          # CLI: bulk-add full catalog to playlist
    ├── config.js           # Environment config
    ├── store.js            # JSON file persistence
    ├── spotify-client.js   # Spotify API wrapper with retry logic
    ├── scanner.js          # New release detection
    ├── scheduler.js        # Cron scheduler
    └── playlist.js         # Playlist management
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Your Spotify app client ID | *required* |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app client secret | *required* |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `http://192.168.1.7:8888/callback` |
| `TARGET_PLAYLIST_ID` | Playlist to add tracks to | *required* |
| `SCAN_INTERVAL_HOURS` | Hours between scans | `12` |
| `AUTH_PORT` | Port for auth callback server | `8888` |

---

## How It Works

1. **Scheduler** triggers a scan every N hours (and once on startup)
2. **Scanner** fetches albums/singles for each tracked artist
3. Releases with a `release_date` after `lastChecked` are flagged as new
4. **Playlist Manager** fetches existing playlist tracks to avoid duplicates
5. Only genuinely new tracks are added
6. `lastChecked` timestamp is updated

---

## Troubleshooting

**"Not authenticated" error**
→ Run `npm run auth` first.

**"Missing required config" error**
→ Make sure `.env` exists and all required values are filled in.

**No new tracks being added**
→ Check that your artists have released music since the last scan. On the first run, the bot looks back 14 days.

**Rate limit errors**
→ The bot handles rate limits automatically with exponential backoff. If you track many artists, scans may take longer.
