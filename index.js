// 🎀🎗 index.js — Reddit OAuth Backend with Logging and Redirect
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 10000; 

const CLIENT_ID = '70G0I__N4hh4F48tKem05A'; 
const CLIENT_SECRET = ''; 
const USER_AGENT = 'FancyKarmaVerifier/1.0';
const GOOGLE_SHEET_ID = '1j4bf4NNhFzYZQV3XTEUdutMla2vkTL7MkAPrgHmqx4A';
const GOOGLE_SHEET_NAME = 'karmaLog';

const PASS_REDIRECT_BASE = 'https://microworkers.contact9999.workers.dev/get-task';

app.use(cors());
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync('google-credentials.json', 'utf8')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const logToSheet = async (status, username, karma, ageDays, error = '') => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${GOOGLE_SHEET_NAME}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, status, username || 'unknown', karma || '', `${ageDays} days`, error]],
      },
    });
  } catch (err) {
    console.error('Sheet Logging Error:', err);
  }
};

app.post('/auth', async (req, res) => {
  const { code, redirect_uri, state } = req.body;
  if (!code || !redirect_uri) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return res.status(401).json({ error: 'Invalid auth code' });

    const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': USER_AGENT }
    });

    const meData = await meResponse.json();
    const username = meData.name || 'unknown';
    
    // Exact Karma Logic
    const totalKarma = meData.total_karma || (meData.link_karma + meData.comment_karma);
    
    // Exact Age in DAYS Logic
    const diffInSeconds = (Date.now() / 1000) - meData.created_utc;
    const accountAgeDays = Math.floor(diffInSeconds / (24 * 60 * 60));

    // --- RULES: 1 Karma and 90 Days ---
    if (totalKarma >= 1 && accountAgeDays >= 90) {
      await logToSheet('PASS', username, totalKarma, accountAgeDays);
      const platform = state || 'Worker'; 
      const randomID = Math.floor(Math.random() * 9999);
      const finalLink = `${PASS_REDIRECT_BASE}?workerId=${platform}_${username}_${randomID}`;
      return res.json({ status: 'pass', redirect: finalLink });
    } else {
      await logToSheet('FAIL', username, totalKarma, accountAgeDays, 'Low karma or age');
      return res.json({ status: 'fail', reason: `Insufficient karma (${totalKarma}/1) or age (${accountAgeDays}/90 days)` });
    }

  } catch (error) {
    console.error('❌ Backend error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => res.send('FancyKarma Backend is Live ✅'));
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
