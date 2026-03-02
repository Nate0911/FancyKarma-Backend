const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Reddit Credentials
const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const CLIENT_SECRET = process.env.REDDIT_SECRET;
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';

// Google Sheets Setup
const SPREADSHEET_ID = '1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q';
const creds = require('/etc/secrets/google-credentials.json'); // Path on Render

const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function logToSheet(data) {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow(data);
}

app.post('/verify-reddit', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    try {
        // 1. Get Reddit Access Token
        const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token', 
            `grant_type=authorization_code&code=${code}&redirect_uri=${REDIRECT_URI}`, 
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // 2. Get User Profile
        const userRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}` }
        });

        const { name, total_karma, created_utc } = userRes.data;
        const accountAgeDays = Math.floor(((Date.now() / 1000) - created_utc) / 86400);
        
        // 3. Eligibility Check (90 days OR 1 karma)
        const isEligible = accountAgeDays >= 90 || total_karma >= 1;

        if (isEligible) {
            await logToSheet({ Username: name, Karma: total_karma, AgeDays: accountAgeDays, Date: new Date().toISOString() });
        }

        res.json({ success: true, eligible: isEligible, username: name });

    } catch (error) {
        console.error('Reddit Error:', error.response?.data || error.message);
        res.status(401).json({ success: false, message: 'Verification failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend live on port ${PORT}`));
