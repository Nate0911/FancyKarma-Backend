// 🎀🎗 index.js — Secure Reddit OAuth Backend
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = '0BAj33Q6SwYpuVNmwkasvQ';
const CLIENT_SECRET = ''; // Blank for installed app
const USER_AGENT = 'FancyKarmaVerifier/1.0';

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

    const totalKarma = meData.total_karma || (meData.link_karma + meData.comment_karma);
    const accountAgeMonths = Math.floor((Date.now() / 1000 - meData.created_utc) / (30 * 24 * 60 * 60));
    const isSuspended = !!meData.is_suspended;
    const isBanned = !!meData.is_suspended || meData.subreddit?.banned;

    // Respond with full verification logic
    if (isSuspended || isBanned) {
      return res.json({ status: 'fail', reason: 'Account is suspended or banned' });
    }

    if (totalKarma >= 200 && accountAgeMonths >= 8) {
      return res.json({ status: 'pass', karma: totalKarma, age: accountAgeMonths });
    } else {
      return res.json({
        status: 'fail',
        reason: "Oops, you don't have enough karma or account age is too young",
        karma: totalKarma,
        age: accountAgeMonths
      });
    }

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
