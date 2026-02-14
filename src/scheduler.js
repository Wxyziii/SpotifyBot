const cron = require('node-cron');
const { config } = require('./config');
const { scanForNewReleases } = require('./scanner');
const { addNewTracksToPlaylist } = require('./playlist');
const { setLastChecked } = require('./store');

async function runScan() {
  const startTime = new Date();
  console.log('\n' + '═'.repeat(60));
  console.log(`🚀 Scan started at ${startTime.toISOString()}`);
  console.log('═'.repeat(60) + '\n');

  try {
    const newTracks = await scanForNewReleases();
    const addedCount = await addNewTracksToPlaylist(newTracks);

    setLastChecked(startTime.toISOString());

    const endTime = new Date();
    const durationSec = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Scan completed at ${endTime.toISOString()}`);
    console.log(`   Duration: ${durationSec}s | Tracks added: ${addedCount}`);
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ Scan failed:', err.message);
    console.error('   Will retry on next scheduled run.\n');
  }
}

function startScheduler() {
  const hours = config.scanIntervalHours;

  // Build cron expression: run every N hours
  // e.g., 12 hours → "0 */12 * * *"
  const cronExpression = `0 */${hours} * * *`;

  console.log(`⏰ Scheduler active: scanning every ${hours} hour(s)`);
  console.log(`   Cron expression: ${cronExpression}`);
  console.log(`   Next scans will run automatically.\n`);

  const task = cron.schedule(cronExpression, () => {
    runScan();
  });

  return task;
}

module.exports = { runScan, startScheduler };
