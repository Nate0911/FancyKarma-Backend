import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 10000;

// Credentials from your screenshots
const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const CLIENT_SECRET = process.env.REDDIT_SECRET; 
const USER_AGENT = 'FancyKarma/1.0';
const GOOGLE_SHEET_ID = '1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q';

app.use(cors());
app.use(express.json());

// Fixed: Status routes so "Server Status" light works
app.get('/', (req, res) => res.send("FancyKarma Backend Online"));
app.get('/ping', (req, res) => res.json({ status: "online" }));

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync('/etc/secrets/google-credentials.json', 'utf8')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getAndLockTask(rowToLock = null) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID, range: 'Sheet1!A:D',
  });
  const rows = response.data.values || [];
  if (rowToLock) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Sheet1!C${rowToLock}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[new Date().toLocaleString()]] },
    });
    return true;
  }
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][2]) return { rowIndex: i + 1, comment: rows[i][1], postUrl: rows[i][3] };
  }
  return null;
}

app.post('/auth', async (req, res) => {
  const { code, redirect_uri } = req.body;
  try {
    const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: { 
        'Authorization': authHeader, 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT 
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) return res.json({ status: 'fail', reason: `401 Error: ${tokenData.error}` });

    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': USER_AGENT }
    });
    const meData = await meRes.json();
    const karma = (meData.total_karma || 0);
    const ageDays = Math.floor(((Date.now() / 1000) - meData.created_utc) / 86400);

    if (ageDays >= 90 || karma >= 1) {
      const task = await getAndLockTask();
      if (!task) return res.json({ status: 'fail', reason: "Out of tasks." });
      return res.json({ status: 'pass', task });
    }
    return res.json({ status: 'fail', reason: `Low stats: ${karma}K / ${ageDays}D` });
  } catch (e) { return res.json({ status: 'fail', reason: "Connection Timeout." }); }
});

app.post('/verify-task', async (req, res) => {
  const { commentUrl, rowIndex } = req.body;
  try {
    const jsonUrl = commentUrl.split('?')[0].replace(/\/$/, "") + ".json";
    const response = await fetch(jsonUrl, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();
    if (data[1].data.children[0].data.collapsed) return res.json({ status: 'fail', message: "Comment hidden." });
    await getAndLockTask(rowIndex);
    return res.json({ status: 'pass', message: "Verified!" });
  } catch (e) { return res.json({ status: 'fail', message: "Invalid URL." }); }
});

app.listen(PORT, () => console.log(`Live on ${PORT}`));
