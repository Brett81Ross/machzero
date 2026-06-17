import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { imagesBase64, userId } = req.body;

        if (!imagesBase64 || !imagesBase64[0]) {
            return res.status(400).send("No image provided.");
        }

        const systemInstruction = "You are the MachZero AI resale expert. Analyze coins, currency, and trading cards. Provide identification, value ranges, and tips.";
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction });

        const result = await model.generateContent([
            "Analyze this item for market resale value.",
            { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
        ]);

        const responseText = result.response.text();

        // Cloud Save
        if (userId) {
            try {
                await redis.lpush(`history:${userId}`, JSON.stringify({ 
                    timestamp: new Date().toISOString(), 
                    result: responseText 
                }));
                await redis.ltrim(`history:${userId}`, 0, 49);
            } catch (e) {
                console.error("Redis error:", e);
            }
        }

        res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });
    } catch (error) {
        console.error("Critical Analysis Error:", error);
        res.status(500).send("Server Error: " + error.message);
    }
}
