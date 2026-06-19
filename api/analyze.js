import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Helper for timing
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { imagesBase64, userId } = req.body;
        if (!imagesBase64 || !imagesBase64[0]) return res.status(400).json({ error: "No image provided" });

        const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

        let result;
        let attempts = 0;
        const maxAttempts = 3;

        // Exponential Backoff with Jitter
        while (attempts < maxAttempts) {
            try {
                result = await model.generateContent([
                    "Analyze this item for market resale value. Provide identification, estimated value, and condition factors.",
                    { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
                ]);
                break; 
            } catch (err) {
                attempts++;
                if (err.message.includes('503') && attempts < maxAttempts) {
                    // (2000ms * attempt) + random jitter (0-1000ms)
                    const waitTime = (2000 * attempts) + (Math.random() * 1000);
                    console.log(`Busy, retry ${attempts} in ${Math.round(waitTime)}ms`);
                    await delay(waitTime);
                } else {
                    throw err;
                }
            }
        }

        const responseText = result.response.text();

        // Save history
        if (userId) {
            try {
                await redis.lpush(`history:${userId}`, JSON.stringify({ 
                    timestamp: new Date().toISOString(), 
                    result: responseText 
                }));
                await redis.ltrim(`history:${userId}`, 0, 49);
            } catch (e) { console.error("Redis fail:", e); }
        }

        res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });

    } catch (error) {
        console.error("Critical Error:", error);
        
        // GRACEFUL DEGRADATION:
        // Instead of a scary server crash message, we provide a clear, 
        // helpful message that the app can display to the user.
        res.status(503).json({ 
            error: "The analysis engine is currently at peak capacity.",
            suggestion: "Our servers are busy processing a high volume of items. Please wait a moment and try your analysis again." 
        });
    }
}
