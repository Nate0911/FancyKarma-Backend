// 🎀🎗 index.js — Reddit OAuth Backend for FancyKarma
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/auth', async (req, res) => {
  const { code, clientId, clientSecret, redirectUri } = req.body;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(401).json({ error: 'Invalid authorization code' });
    }

    const accessToken = tokenData.access_token;

    // Get Reddit user info
    const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'FancyKarmaVerifier/1.0'
      }
    });

    const meData = await meResponse.json();

    if (!meData || !meData.name) {
      return res.status(400).json({ error: 'Could not fetch user info' });
    }

    // Calculate total karma
    const totalKarma = meData.link_karma + meData.comment_karma;

    // Calculate account age in months
    const accountAgeSeconds = Date.now() / 1000 - meData.created_utc;
    const accountAgeMonths = Math.floor(accountAgeSeconds / (30 * 24 * 60 * 60));

    // Banned or Suspended Check
    const isSuspended = !!meData.has_verified_email === false && !!meData.is_suspended === true;
    const isBanned = !!meData.is_suspended || meData.subreddit?.banned;

    // Final response
    return res.json({
      karma: totalKarma,
      account_age_months: accountAgeMonths,
      isSuspended,
      isBanned
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
