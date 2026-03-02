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

// Routes to fix "Cannot GET /"
app.get('/', (req, res) => res.send("Server Online"));
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
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) return res.json({ status: 'fail', reason: `Reddit 401: ${tokenData.error}` });

    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': USER_AGENT }
    });
    const meData = await meRes.json();
    const karma = (meData.total_karma || 0);
    const ageDays = Math.floor(((Date.now() / 1000) - meData.created_utc) / 86400);

    if (ageDays >= 90 || karma >= 1) {
      const task = await getAndLockTask();
      return res.json({ status: 'pass', task });
    }
    return res.json({ status: 'fail', reason: "Stats too low." });
  } catch (e) { return res.json({ status: 'fail', reason: "Timeout." }); }
});

app.listen(PORT, () => console.log(`Live`));
