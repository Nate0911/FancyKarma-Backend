// 🎀🎗 FancyKarma Reddit OAuth Backend (Installed App + Google Sheet Logging)
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = '70G0I__N4hh4F48tKem05A';
const USER_AGENT = 'FancyKarmaVerifier/1.0';
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';
const SHEET_ID = '1j4bf4NNhFzYZQV3XTEUdutMla2vkTL7MkAPrgHmqx4A';

app.use(cors());
app.use(express.json());

// 🧠 Google Sheets Setup
const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function logToSheet(status, username, karma, age, reason) {
  const now = new Date().toLocaleString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[now, status, username || 'unknown', karma ?? '', reason || age]],
    },
  });
}

// 🔐 Main OAuth Handler
app.post('/auth', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      await logToSheet('FAIL', '', '', '', 'Invalid code (no token)');
      return res.status(401).json({ error: 'Invalid authorization code' });
    }

    // Step 2: Use access token to get user info
    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': USER_AGENT,
      },
    });
    const me = await meRes.json();

    const totalKarma = me.total_karma ?? (me.link_karma + me.comment_karma);
    const ageMonths = Math.floor((Date.now() / 1000 - me.created_utc) / (30 * 24 * 60 * 60));
    const isSuspended = !!me.is_suspended;
    const isBanned = !!me.is_suspended || me.subreddit?.banned;

    if (isSuspended || isBanned) {
      await logToSheet('FAIL', me.name, totalKarma, ageMonths, 'Banned or suspended');
      return res.json({ status: 'fail', reason: 'Account is suspended or banned' });
    }

    if (totalKarma >= 200 && ageMonths >= 8) {
      await logToSheet('PASS', me.name, totalKarma, ageMonths, '');
      return res.json({ status: 'pass', karma: totalKarma, age: ageMonths });
    } else {
      await logToSheet('FAIL', me.name, totalKarma, ageMonths, 'Not enough karma or age');
      return res.json({
        status: 'fail',
        reason: 'Oops, you don’t have enough karma or account age is too young',
        karma: totalKarma,
        age: ageMonths,
      });
    }
  } catch (err) {
    console.error('❌ Server error:', err);
    await logToSheet('FAIL', '', '', '', 'Internal server error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ FancyKarma Backend (Installed App) is Live');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
