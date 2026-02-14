const http = require('http');
const { config, validate } = require('./config');
const { createApi } = require('./spotify-client');
const { saveTokens } = require('./store');

async function authenticate() {
  validate(['clientId', 'clientSecret', 'redirectUri']);

  const spotifyApi = createApi();
  const authorizeUrl = spotifyApi.createAuthorizeURL(config.scopes, 'spotify-bot-state');

  console.log('\n🔐 Spotify Authentication');
  console.log('─'.repeat(50));

  // Try to open browser automatically, fall back to manual
  let open;
  try {
    open = (await import('open')).default;
  } catch {
    open = null;
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${config.authPort}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`Authentication failed: ${error}`);
        server.close();
        reject(new Error(`Auth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code.');
        return;
      }

      try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token, expires_in } = data.body;

        saveTokens({
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + expires_in * 1000,
        });

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
            <h1>✅ Authentication Successful</h1>
            <p>You can close this window and return to the terminal.</p>
          </body></html>
        `);

        console.log('\n✅ Authentication successful! Tokens saved.');
        console.log('   You can now run: npm start');
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500);
        res.end('Failed to exchange authorization code.');
        server.close();
        reject(err);
      }
    });

    server.listen(config.authPort, '0.0.0.0', () => {
      console.log(`\n📡 Callback server listening on port ${config.authPort}`);
      console.log('\n🌐 Open this URL in your browser to authenticate:\n');
      console.log(`   ${authorizeUrl}\n`);

      // Try to open browser (works on desktop, silently ignored on headless servers)
      if (open) {
        open(authorizeUrl).catch(() => {});
      }
    });

    server.on('error', (err) => {
      console.error(`❌ Server error: ${err.message}`);
      reject(err);
    });
  });
}

// Run directly
if (require.main === module) {
  authenticate().catch((err) => {
    console.error('❌ Authentication failed:', err.message);
    process.exit(1);
  });
}

module.exports = { authenticate };
