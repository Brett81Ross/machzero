import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
    
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    
    try {
        const history = await redis.lrange(`history:${userId}`, 0, 49);
        const parsedHistory = history.map(item => JSON.parse(item));
        res.status(200).json(parsedHistory);
    } catch (error) {
        res.status(500).json({ error: "Could not retrieve history" });
    }
}
