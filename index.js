const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();

// FIXED CORS: This tells Render to allow requests from your GitHub Pages
app.use(cors({
    origin: 'https://nate0911.github.io',
    methods: ['POST', 'GET'],
    credentials: true
}));

app.use(express.json());

const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';

// Keep-alive route to check if server is up
app.get('/', (req, res) => res.send('FancyKarma Backend is Running'));

app.post('/verify-reddit', async (req, res) => {
    const { code } = req.body;
    const REDDIT_SECRET = process.env.REDDIT_SECRET;

    if (!REDDIT_SECRET) {
        console.error("SECRET MISSING IN RENDER ENV");
        return res.status(500).json({ error: "Server Secret Missing" });
    }

    try {
        const auth = Buffer.from(`${CLIENT_ID}:${REDDIT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token', 
            params.toString(), 
            { headers: { 
                'Authorization': `Basic ${auth}`, 
                'Content-Type': 'application/x-www-form-urlencoded', 
                'User-Agent': 'FancyKarma/1.0.0' 
            }}
        );

        const userRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 
                'Authorization': `Bearer ${tokenRes.data.access_token}`, 
                'User-Agent': 'FancyKarma/1.0.0' 
            }
        });

        const { name, link_karma, comment_karma, created_utc } = userRes.data;
        const total_karma = link_karma + comment_karma;
        const ageInDays = Math.floor(((Date.now() / 1000) - created_utc) / 86400);

        const isEligible = ageInDays >= 90 || total_karma >= 1;

        if (isEligible) {
            try {
                const creds = JSON.parse(fs.readFileSync('/etc/secrets/google-credentials.json'));
                const doc = new GoogleSpreadsheet('1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q', new JWT({
                    email: creds.client_email,
                    key: creds.private_key,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                }));
                await doc.loadInfo();
                await doc.sheetsByIndex[0].addRow({ Username: name, Karma: total_karma, Age: ageInDays });
            } catch (e) { console.log("Sheet Log Fail:", e.message); }
        }

        res.json({ success: true, eligible: isEligible, username: name, details: { karma: total_karma, age: ageInDays } });

    } catch (err) {
        console.error("REDDIT REJECT:", err.response?.data || err.message);
        res.status(401).json({ error: "Reddit Reject" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server Live on port ${PORT}`));
