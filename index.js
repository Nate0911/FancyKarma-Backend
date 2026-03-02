const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';

app.post('/verify-reddit', async (req, res) => {
    try {
        const { code } = req.body;
        const REDDIT_SECRET = process.env.REDDIT_SECRET;

        const auth = Buffer.from(`${CLIENT_ID}:${REDDIT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token', 
            params.toString(), 
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'FancyKarma/1.0' } }
        );

        const userRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}`, 'User-Agent': 'FancyKarma/1.0' }
        });

        const { name, link_karma, comment_karma, created_utc } = userRes.data;
        const total_karma = link_karma + comment_karma;
        const ageInDays = Math.floor(((Date.now() / 1000) - created_utc) / 86400);
        const isEligible = ageInDays >= 90 || total_karma >= 1;

        if (isEligible) {
            try {
                const credsPath = path.join(__dirname, 'credentials.json');
                if (fs.existsSync(credsPath)) {
                    const creds = JSON.parse(fs.readFileSync(credsPath));
                    const doc = new GoogleSpreadsheet('1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q', new JWT({
                        email: creds.client_email,
                        key: creds.private_key,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                    }));
                    await doc.loadInfo();
                    const sheet = doc.sheetsByTitle['karmaLog'] || doc.sheetsByIndex[0];
                    await sheet.addRow({ Username: name, Karma: total_karma, Age: ageInDays, Timestamp: new Date().toLocaleString() });
                }
            } catch (sheetErr) { console.error("Sheets Error:", sheetErr.message); }
        }

        res.json({ success: true, eligible: isEligible, username: name, details: { karma: total_karma, age: ageInDays } });

    } catch (err) {
        console.error("Auth Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
