// server.js - Local Development Server (Optional)
import express from 'express';
import cron from 'node-cron';
import { fetchAndStoreFeeds, initialFullSync } from './lib/fetchFeeds.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Manual trigger endpoint for testing
app.post('/fetch-feeds', async (req, res) => {
  try {
    const forceFullSync = req.query.full === 'true';
    await fetchAndStoreFeeds(forceFullSync);
    res.json({ message: `Feeds fetched successfully (${forceFullSync ? 'full sync' : 'incremental'})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initial sync endpoint
app.post('/initial-sync', async (req, res) => {
  try {
    await initialFullSync();
    res.json({ message: 'Initial full sync completed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule cron job for every 15 minutes (for local development)
cron.schedule('*/15 * * * *', async () => {
  console.log('Running scheduled incremental feed fetch...');
  await fetchAndStoreFeeds(false); // Incremental update
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Cron job scheduled to run every 15 minutes (incremental updates)');
});