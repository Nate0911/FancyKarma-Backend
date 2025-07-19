// 🎀🎗 index.js — Reddit OAuth + Google Sheets Logger
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = '0BAj33Q6SwYpuVNmwkasvQ';
const CLIENT_SECRET = ''; // No secret for installed apps
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';
const USER_AGENT = 'FancyKarmaVerifier/1.0';
const SHEET_ID = '1j4bf4NNhFzYZQV3XTEUdutMla2vkTL7MkAPrgHmqx4A';

// Google Sheets Setup
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync('google-credentials.json', 'utf8')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

app.use(cors());
app.use(express.json());

app.post('/auth', async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

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
        redirect_uri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(401).json({ error: 'Invalid authorization code' });
    }

    const accessToken = tokenData.access_token;

    const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT
      }
    });

    const meData = await meResponse.json();
    const username = meData.name || 'Unknown';
    const totalKarma = meData.total_karma ?? (meData.link_karma + meData.comment_karma);
    const accountAgeMonths = Math.floor((Date.now() / 1000 - meData.created_utc) / (30 * 24 * 60 * 60));
    const isSuspended = !!meData.is_suspended;
    const isBanned = isSuspended || meData.subreddit?.banned;

    let status = 'fail';
    let reason = "Oops, you don't have enough karma or account age is too young";

    if (isSuspended || isBanned) {
      status = 'banned';
      reason = 'Account is suspended or banned';
    } else if (totalKarma >= 200 && accountAgeMonths >= 8) {
      status = 'pass';
      reason = '✅ Meets requirements';
    }

    // Log to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toLocaleString(),
          username,
          totalKarma,
          accountAgeMonths,
          status,
          reason
        ]]
      }
    });

    return res.json({
      status,
      karma: totalKarma,
      age: accountAgeMonths,
      reason
    });

  } catch (error) {
    console.error('❌ Backend error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('FancyKarma Backend is Live ✅');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
