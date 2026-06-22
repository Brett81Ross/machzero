const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
    }

    try {
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        const history = await redis.lrange(`history:${userId}`, 0, -1);
        const parsedHistory = history.map(item => typeof item === 'string' ? JSON.parse(item) : item);

        return res.status(200).json(parsedHistory);
    } catch (error) {
        return res.status(500).json({ error: 'Database Connection Error: ' + error.message });
    }
};
