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

    const { imagesBase64, userId } = req.body;
    if (!imagesBase64 || !imagesBase64[0]) return res.status(400).json({ error: "No image provided" });

    // Define model chain for fallback strategy
    const modelChain = ["gemini-3-flash", "gemini-1.5-flash"];
    let lastError;

    for (const modelName of modelChain) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    "Analyze this item for market resale value. Provide identification, estimated value, and condition factors.",
                    { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
                ]);

                const responseText = result.response.text();

                // Save to history on success
                if (userId) {
                    try {
                        await redis.lpush(`history:${userId}`, JSON.stringify({ 
                            timestamp: new Date().toISOString(), 
                            result: responseText 
                        }));
                        await redis.ltrim(`history:${userId}`, 0, 49);
                    } catch (e) { console.error("Redis fail:", e); }
                }

                return res.status(200).json({ content: responseText });
            } catch (err) {
                lastError = err;
                attempts++;
                
                // Only retry on 503 (High Demand/Overloaded)
                if (err.message.includes('503') && attempts < maxAttempts) {
                    const waitTime = (2000 * attempts) + (Math.[span_2](start_span)random() * 1000); // Exponential backoff + Jitter[span_2](end_span)
                    await delay(waitTime);
                } else {
                    // Break the retry loop and try the next model in the chain
                    break;
                }
            }
        }
    }

    // If we reach here, all retries and fallback models failed
    console.error("Critical Error after fallback:", lastError);
    res.status(503).json({ 
        error: "The analysis engine is currently at peak capacity.",
        suggestion: "Our servers are busy processing a high volume of items. Please wait a moment and try your analysis again." 
    });
}
