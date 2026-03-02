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
const GOOGLE_SHEET_ID = '1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q';

app.use(cors());
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync('google-credentials.json', 'utf8')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getAndLockTask(rowToLock = null) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A:D',
  });
  const rows = response.data.values || [];

  if (rowToLock) {
    const now = new Date().toLocaleString();
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Sheet1!C${rowToLock}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[now]] },
    });
    return true;
  }

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][2]) { 
      return { rowIndex: i + 1, comment: rows[i][1], postUrl: rows[i][3] };
    }
  }
  return null;
}

app.post('/auth', async (req, res) => {
  const { code, redirect_uri } = req.body;
  try {
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri })
    });
    const tokenData = await tokenResponse.json();
    const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-User-Agent': USER_AGENT }
    });
    const meData = await meResponse.json();
    const karma = meData.total_karma || 0;
    const ageDays = Math.floor(((Date.now() / 1000) - meData.created_utc) / 86400);

    if (karma >= 1 && ageDays >= 90) {
      const task = await getAndLockTask();
      if (!task) return res.json({ status: 'fail', reason: "No tasks available." });
      return res.json({ status: 'pass', task });
    }
    return res.json({ status: 'fail', reason: `Low stats: ${karma} Karma / ${ageDays} Days.` });
  } catch (e) { return res.status(500).json({ error: "Server Error" }); }
});

app.post('/verify-task', async (req, res) => {
  const { commentUrl, rowIndex } = req.body;
  try {
    const jsonUrl = commentUrl.split('?')[0].replace(/\/$/, "") + ".json";
    const response = await fetch(jsonUrl, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();
    const commentData = data[1].data.children[0].data;

    if (commentData.collapsed) {
      return res.json({ status: 'fail', message: "Your comment is collapsed! Reddit is hiding your account." });
    }
    await getAndLockTask(rowIndex);
    return res.json({ status: 'pass', message: "Success! Your comment is visible. Please paste it in the Proof page." });
  } catch (e) { return res.json({ status: 'fail', message: "Invalid Link. Ensure you copied the 'Share Link' of your comment." }); }
});

app.listen(PORT, () => console.log(`Backend Live on ${PORT}`));
