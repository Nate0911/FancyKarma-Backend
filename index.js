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
        console.log("LOG 1: Received code from frontend");

        const auth = Buffer.from(`${CLIENT_ID}:${process.env.REDDIT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token', params.toString(), {
            headers: { 'Authorization': `Basic ${auth}`, 'User-Agent': 'FancyKarma/1.0' }
        });

        const userRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}`, 'User-Agent': 'FancyKarma/1.0' }
        });

        const { name, link_karma, comment_karma, created_utc } = userRes.data;
        const total_karma = link_karma + comment_karma;
        const ageInDays = Math.floor(((Date.now() / 1000) - created_utc) / 86400);

        console.log(`LOG 2: User ${name} fetched. Karma: ${total_karma}, Age: ${ageInDays}`);

        // --- GOOGLE SHEETS SECTION ---
        const credsPath = '/etc/secrets/credentials.json';
        console.log(`LOG 3: Checking for file at ${credsPath}`);

        if (fs.existsSync(credsPath)) {
            console.log("LOG 4: File found. Connecting to Google...");
            const creds = JSON.parse(fs.readFileSync(credsPath));
            const doc = new GoogleSpreadsheet('1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q', new JWT({
                email: creds.client_email,
                key: creds.private_key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            }));

            await doc.loadInfo();
            console.log("LOG 5: Google Sheet loaded info.");

            const sheet = doc.sheetsByTitle['karmaLog'] || doc.sheetsByIndex[0];
            await sheet.addRow({ 
                Username: name, 
                Karma: total_karma, 
                Age: ageInDays, 
                Timestamp: new Date().toLocaleString() 
            });
            console.log("LOG 6: SUCCESS - Row added to sheet.");
        } else {
            console.log("LOG 4-ERROR: credentials.json is MISSING from the server.");
        }

        res.json({ success: true, eligible: true, username: name, details: { karma: total_karma, age: ageInDays } });

    } catch (err) {
        console.error("LOG ERROR:", err.message);
        res.status(500).json({ error: "Internal Error", detail: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend listening on ${PORT}`));
