const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// These MUST match your Reddit App exactly
const CLIENT_ID = 'u8MeOBIFfObKKRsdmExg_w';
const REDIRECT_URI = 'https://nate0911.github.io/Fancykarma/redirect.html';

app.post('/verify-reddit', async (req, res) => {
    const { code } = req.body;
    const REDDIT_SECRET = process.env.REDDIT_SECRET;

    // 1. Manually build the Base64 string to ensure no hidden characters
    const auth = Buffer.from(`${CLIENT_ID}:${REDDIT_SECRET}`).toString('base64');

    try {
        // 2. Use URLSearchParams - this is the most reliable "form-data" method
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        const response = await axios({
            method: 'post',
            url: 'https://www.reddit.com/api/v1/access_token',
            data: params.toString(),
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'FancyKarma/1.0.0' // Reddit rejects empty User-Agents
            }
        });

        const token = response.data.access_token;

        // 3. Get the user data
        const userResponse = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'FancyKarma/1.0.0'
            }
        });

        const { name, total_karma, created_utc } = userResponse.data;
        const ageDays = Math.floor(((Date.now() / 1000) - created_utc) / 86400);
        const isEligible = ageDays >= 90 || total_karma >= 1;

        res.json({ success: true, eligible: isEligible, username: name });

    } catch (error) {
        // This will show the EXACT reason in the Render logs
        console.error("REDDIT REJECTED REQUEST:", error.response?.data || error.message);
        res.status(401).json({ error: "Auth Failed", details: error.response?.data });
    }
});

app.listen(process.env.PORT || 10000);
