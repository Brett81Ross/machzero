import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { imagesBase64, userId } = req.body;
        if (!imagesBase64 || !imagesBase64[0]) return res.status(400).json({ error: "No image" });

        // Switched to gemini-3-flash for higher stability during peak demand
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

        let result;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                result = await model.generateContent([
                    "Analyze this item for market resale value.",
                    { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
                ]);
                break; // Success!
            } catch (err) {
                attempts++;
                if (err.message.includes('503') && attempts < maxAttempts) {
                    await delay(2000 * attempts); // Exponential backoff
                } else {
                    throw err;
                }
            }
        }

        const responseText = result.response.text();

        if (userId) {
            try {
                const historyKey = `history:${userId}`;
                await redis.lpush(historyKey, JSON.stringify({ timestamp: new Date().toISOString(), result: responseText }));
                await redis.ltrim(historyKey, 0, 49);
            } catch (e) { console.error("Redis log failed:", e); }
        }

        res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });
    } catch (error) {
        console.error("Critical Error:", error);
        res.status(500).json({ error: "Service currently overloaded. Please try again in a moment." });
    }
}
