# 🎵 Spotify Release Bot

Automatically detects new releases from your favorite artists and adds them to a Spotify playlist. Everything is managed through a single interactive terminal menu — just run `npm start`.

## Features

- **Interactive menu** — authenticate, manage artists, scan, and start the bot from one command
- Tracks only artists you manually select
- Bulk-add entire artist catalogs to your playlist
- Scans every 12 hours (configurable) for new releases
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
   - **Redirect URI**: `http://127.0.0.1:8888/callback`
4. Check the **Web API** checkbox
5. Click **Save**
6. Note your **Client ID** and **Client Secret**

> **Headless / SSH setup:** If running on a remote server, use SSH port forwarding so the callback works from your local browser:
> ```bash
> ssh -L 8888:127.0.0.1:8888 user@your-server-ip
> ```

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
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
TARGET_PLAYLIST_ID=your_playlist_id_here
SCAN_INTERVAL_HOURS=12
AUTH_PORT=8888
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Start the Bot

```bash
npm start
```

This opens the interactive menu:

```
  ╔══════════════════════════════════════════╗
  ║         🎵  Spotify Release Bot          ║
  ╚══════════════════════════════════════════╝

  Status:    ❌ Not authenticated
  Artists:   0 tracked
  Playlist:  your_playlist_id
  Interval:  Every 12h

  ┌──────────────────────────────────────────┐
  │  1.  🔐  Authenticate with Spotify       │
  │  2.  ➕  Add artist                      │
  │  3.  ➖  Remove artist                   │
  │  4.  📋  View tracked artists            │
  │  5.  📀  Add all songs to playlist       │
  │  6.  🔍  Run scan now                    │
  │  7.  🚀  Start bot (24/7 auto-scan)     │
  │  0.  🚪  Exit                            │
  └──────────────────────────────────────────┘
```

**First time:**
1. Select **1** to authenticate (prints a URL — open it in your browser)
2. Select **2** to add artists (search by name, pick from results)
3. Select **7** to start the 24/7 bot

---

## Menu Options

| Option | Description |
|--------|-------------|
| **1. Authenticate** | Run the Spotify OAuth flow. Prints a URL to open in your browser. Only needed once. |
| **2. Add artist** | Search for an artist by name, select from results, and start tracking them. |
| **3. Remove artist** | Remove a tracked artist from the list. |
| **4. View artists** | Show all currently tracked artists. |
| **5. Add all songs** | One-time bulk import of every album/single from all tracked artists into the playlist. |
| **6. Run scan now** | Manually trigger a scan for new releases. |
| **7. Start bot** | Enter 24/7 mode — runs an immediate scan, then auto-scans every N hours. |
| **0. Exit** | Quit the program. |

---

## Running with PM2 (Recommended for Production)

Once you've authenticated and added artists via the menu, use PM2 to run the bot in 24/7 mode.

### Install PM2

```bash
npm install -g pm2
```

### Start the Bot with PM2

Since PM2 runs non-interactively, start the bot directly in bot mode:

```bash
pm2 start src/index.js --name spotify-bot -- --bot
```

> **Note:** Run `npm start` interactively first to authenticate and add artists. Then use PM2 for the 24/7 bot.

### Useful PM2 Commands

```bash
pm2 logs spotify-bot     # View logs
pm2 status               # Check status
pm2 restart spotify-bot  # Restart
pm2 stop spotify-bot     # Stop
pm2 delete spotify-bot   # Remove
```

### Auto-Start on System Boot

```bash
pm2 startup
# Follow the instructions it prints, then:
pm2 save
```

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
    ├── index.js            # Entry point
    ├── menu.js             # Interactive terminal menu
    ├── auth.js             # Spotify OAuth flow
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
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `http://127.0.0.1:8888/callback` |
| `TARGET_PLAYLIST_ID` | Playlist to add tracks to | *required* |
| `SCAN_INTERVAL_HOURS` | Hours between scans | `12` |
| `AUTH_PORT` | Port for auth callback server | `8888` |

---

## Troubleshooting

**"Not authenticated" error**
→ Select option 1 from the menu to authenticate.

**"Missing required config" error**
→ Make sure `.env` exists and all required values are filled in.

**"INVALID_CLIENT: Insecure redirect URI"**
→ Spotify requires `http://127.0.0.1` (not `localhost` or a LAN IP). If on a remote server, use SSH port forwarding.

**No new tracks being added**
→ Check that your artists have released music since the last scan. On the first run, the bot looks back 14 days.

**Rate limit errors**
→ The bot handles rate limits automatically with exponential backoff.
