const readline = require('readline');
const { validate } = require('./config');
const { searchArtists } = require('./spotify-client');
const { addArtist, loadTokens } = require('./store');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function addArtistCommand() {
  validate(['clientId', 'clientSecret']);

  const tokens = loadTokens();
  if (!tokens) {
    console.error('❌ Not authenticated. Run: npm run auth');
    process.exit(1);
  }

  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('❌ Usage: npm run add-artist "Artist Name"');
    process.exit(1);
  }

  console.log(`\n🔍 Searching for "${query}"...\n`);

  try {
    const artists = await searchArtists(query);

    if (!artists.length) {
      console.log('❌ No artists found. Try a different search term.');
      rl.close();
      return;
    }

    console.log('─'.repeat(50));
    artists.forEach((artist, i) => {
      const followers = artist.followers?.total?.toLocaleString() || '0';
      const genres = artist.genres?.slice(0, 3).join(', ') || 'N/A';
      console.log(`  ${i + 1}. ${artist.name}`);
      console.log(`     Followers: ${followers} | Genres: ${genres}`);
    });
    console.log('─'.repeat(50));
    console.log(`  0. Cancel\n`);

    const answer = await ask('Select an artist (number): ');
    const index = parseInt(answer, 10);

    if (index === 0 || isNaN(index) || index < 1 || index > artists.length) {
      console.log('Cancelled.');
      rl.close();
      return;
    }

    const selected = artists[index - 1];
    const added = addArtist({ name: selected.name, id: selected.id });

    if (added) {
      console.log(`\n✅ Now tracking: ${selected.name} (${selected.id})`);
    }
  } catch (err) {
    console.error('❌ Error searching artists:', err.message);
  }

  rl.close();
}

addArtistCommand();
