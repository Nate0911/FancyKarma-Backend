const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';

app.post('/verify-reddit', async (req, res) => {
    try {
        const { code } = req.body;
        
        // 1. Reddit Auth - Using Basic Auth for Personal Use Script
        const auth = Buffer.from(`${CLIENT_ID}:${process.env.REDDIT_SECRET}`).toString('base64');
        
        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token', 
            `grant_type=authorization_code&code=${code}&redirect_uri=${REDIRECT_URI}`, 
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // 2. Get User Info
        const userRes = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}` }
        });

        const { name, total_karma, created_utc } = userRes.data;
        const ageDays = Math.floor(((Date.now() / 1000) - created_utc) / 86400);
        const isEligible = ageDays >= 90 || total_karma >= 1;

        // 3. Google Sheets Logging
        if (isEligible) {
            const creds = JSON.parse(fs.readFileSync('/etc/secrets/google-credentials.json'));
            const doc = new GoogleSpreadsheet('1eGSSYlKX-lX7t3Ohhq_ySHBjwWcxh37sicx7ONw0Z6Q', new JWT({
                email: creds.client_email,
                key: creds.private_key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            }));
            await doc.loadInfo();
            await doc.sheetsByIndex[0].addRow({ Username: name, Karma: total_karma, Age: ageDays });
        }

        res.json({ eligible: isEligible, username: name });
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(401).send("Unauthorized");
    }
});

app.listen(process.env.PORT || 3000);
