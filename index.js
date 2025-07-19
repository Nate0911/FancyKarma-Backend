// 🎀🎗 FancyKarma Backend — Reddit OAuth + Google Sheet Logging
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = '70G0I__N4hh4F48tKem05A';
const CLIENT_SECRET = ''; // Installed apps use blank
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';
const USER_AGENT = 'FancyKarmaVerifier/1.0';
const SHEET_ID = '1j4bf4NNhFzYZQV3XTEUdutMla2vkTL7MkAPrgHmqx4A';
const SHEET_NAME = 'karmaLog';

// Load Google credentials
const credentials = JSON.parse(fs.readFileSync('./google-credentials.json', 'utf-8'));
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);
const sheets = google.sheets({ version: 'v4', auth });

app.use(cors());
app.use(express.json());

// Logging function
async function logToSheet({ status, username, karma, age, reason = '' }) {
  const row = [
    new Date().toLocaleString(),
    status.toUpperCase(),
    username || 'unknown',
    karma || '',
    reason || `Age: ${age || '?'}`
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
    console.log(`✅ Logged to sheet:`, row);
  } catch (error) {
    console.error('❌ Google Sheet logging failed:', error);
  }
}

// OAuth verification endpoint
app.post('/auth', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      await logToSheet({ status: 'fail', username: '', reason: 'Invalid authorization code' });
      return res.status(401).json({ error: 'Invalid authorization code' });
    }

    const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': USER_AGENT
      }
    });
    const meData = await meResponse.json();

    const username = meData.name;
    const totalKarma = meData.total_karma || (meData.link_karma + meData.comment_karma);
    const accountAgeMonths = Math.floor((Date.now() / 1000 - meData.created_utc) / (30 * 24 * 60 * 60));
    const isSuspended = !!meData.is_suspended;
    const isBanned = !!meData.is_suspended || meData.subreddit?.banned;

    if (isSuspended || isBanned) {
      await logToSheet({ status: 'fail', username, karma: totalKarma, age: accountAgeMonths, reason: 'Account is suspended or banned' });
      return res.json({ status: 'fail', reason: 'Account is suspended or banned' });
    }

    if (totalKarma >= 200 && accountAgeMonths >= 8) {
      await logToSheet({ status: 'pass', username, karma: totalKarma, age: accountAgeMonths });
      return res.json({ status: 'pass', karma: totalKarma, age: accountAgeMonths });
    } else {
      await logToSheet({ status: 'fail', username, karma: totalKarma, age: accountAgeMonths, reason: "Not enough karma or age" });
      return res.json({ status: 'fail', reason: "Oops, you don't have enough karma or account age is too young", karma: totalKarma, age: accountAgeMonths });
    }

  } catch (error) {
    console.error('❌ Backend error:', error);
    await logToSheet({ status: 'fail', username: '', reason: 'Internal server error' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Status check
app.get('/', (req, res) => {
  res.send('FancyKarma Backend is Live ✅');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
