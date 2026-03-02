const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';

app.post('/verify-reddit', async (req, res) => {
    const { code } = req.body;
    const REDDIT_SECRET = process.env.REDDIT_SECRET;

    try {
        const auth = Buffer.from(`${CLIENT_ID}:${REDDIT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        // 1. Get Token
        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token', 
            params.toString(), 
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'FancyKarma/1.0' } }
        );

        // 2. Get User Profile
        const userRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}`, 'User-Agent': 'FancyKarma/1.0' }
        });

        const { name, link_karma, comment_karma, created_utc } = userRes.data;
        
        // Sum total karma
        const total_karma = link_karma + comment_karma;
        
        // Calculate Age (Reddit sends created_utc in SECONDS)
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const ageInDays = Math.floor((nowInSeconds - created_utc) / 86400);

        // ELIGIBILITY CHECK: 90 days OR 1 karma
        const isEligible = ageInDays >= 90 || total_karma >= 1;

        // 3. Log to Google Sheets
        if (isEligible) {
            try {
                const creds = JSON.parse(fs.readFileSync('/etc/secrets/google-credentials.json'));
                const serviceAccountAuth = new JWT({
                    email: creds.client_email,
                    key: creds.private_key,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
                const doc = new GoogleSpreadsheet('1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q', serviceAccountAuth);
                await doc.loadInfo();
                await doc.sheetsByIndex[0].addRow({ Username: name, Karma: total_karma, Age: ageInDays, Date: new Date().toISOString() });
            } catch (sErr) { console.error("Sheets Error:", sErr.message); }
        }

        // Send detailed response for debugging
        res.json({ 
            success: true, 
            eligible: isEligible, 
            username: name,
            details: { karma: total_karma, age: ageInDays } 
        });

    } catch (err) {
        console.error("Auth Error:", err.response?.data || err.message);
        res.status(401).json({ error: "Unauthorized" });
    }
});

app.listen(process.env.PORT || 10000, () => console.log("Server Live"));
