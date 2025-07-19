// 🎀🎗 index.js — Final Reddit OAuth Backend with Google Sheet Logging and Redirect
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import { readFile } from 'fs/promises';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = '70G0I__N4hh4F48tKem05A'; // Installed app client ID
const CLIENT_SECRET = ''; // Blank for installed apps
const REDIRECT_URL_ON_PASS = 'https://script.google.com/macros/s/AKfycbzT8-4MLHrLa0Hpo_II1O1KfdUuefN9R2KZXjrYZJ3ZAukA0UGwi7H9GJIc3-7KAYj27A/exec';

const SHEET_ID = '1j4bf4NNhFzYZQV3XTEUdutMla2vkTL7MkAPrgHmqx4A';
const SHEET_NAME = 'karmaLog';

app.use(cors());
app.use(express.json());

// Google Sheets Auth
let sheetsClient;
async function authorizeSheets() {
  const credentials = JSON.parse(await readFile('./google-credentials.json', 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  sheetsClient = sheets;
}

// Log to Google Sheet
async function logToSheet(values) {
  if (!sheetsClient) await authorizeSheets();
  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

// Main Auth Handler
app.post('/auth', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      await logToSheet([new Date().toLocaleString(), 'FAIL', 'unknown', '', 'Token exchange failed']);
      return res.status(401).json({ error: 'Invalid authorization code' });
    }

    // Fetch Reddit user info
    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'FancyKarmaVerifier/1.0',
      },
    });
    const me = await meRes.json();
    const totalKarma = me.total_karma || (me.link_karma + me.comment_karma);
    const accountAgeMonths = Math.floor((Date.now() / 1000 - me.created_utc) / (30 * 24 * 60 * 60));
    const isSuspended = !!me.is_suspended;
    const isBanned = isSuspended || !!me.subreddit?.banned;

    // Logging details
    const username = me.name || 'unknown';
    const status = (isBanned || isSuspended)
      ? 'FAIL'
      : (totalKarma >= 200 && accountAgeMonths >= 8 ? 'PASS' : 'FAIL');
    const reason = isBanned
      ? 'Banned or Suspended'
      : totalKarma >= 200 && accountAgeMonths >= 8
      ? 'OK'
      : 'Not enough karma or too young';
    await logToSheet([new Date().toLocaleString(), status, username, totalKarma, reason]);

    // Redirect if pass, else send JSON response
    if (status === 'PASS') {
      return res.json({ redirect: REDIRECT_URL_ON_PASS });
    } else {
      return res.json({ status: 'fail', reason, karma: totalKarma, age: accountAgeMonths });
    }
  } catch (err) {
    console.error('❌ Server Error:', err);
    await logToSheet([new Date().toLocaleString(), 'FAIL', 'unknown', '', 'Internal server error']);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('FancyKarma Backend is Live ✅');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
