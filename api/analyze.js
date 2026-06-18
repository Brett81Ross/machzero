import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Helper function to wait before retrying
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { imagesBase64, userId } = req.body;
        if (!imagesBase64 || !imagesBase64[0]) return res.status(400).json({ error: "No image" });

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        // Attempt the call, if it fails with 503, wait 2 seconds and try once more
        let result;
        try {
            result = await model.generateContent([
                "Analyze this item for market resale value.",
                { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
            ]);
        } catch (err) {
            if (err.message.includes('503')) {
                console.log("503 detected, retrying...");
                await delay(2000);
                result = await model.generateContent([
                    "Analyze this item for market resale value.",
                    { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
                ]);
            } else {
                throw err;
            }
        }

        const responseText = result.response.text();

        if (userId) {
            try {
                const historyKey = `history:${userId}`;
                await redis.lpush(historyKey, JSON.stringify({ timestamp: new Date().toISOString(), result: responseText }));
                await redis.ltrim(historyKey, 0, 49);
            } catch (e) { console.error("Redis fail:", e); }
        }

        res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });
    } catch (error) {
        console.error("Critical Error:", error);
        res.status(500).json({ error: "Server Error: " + error.message });
    }
}
