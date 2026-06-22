import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { imagesBase64 } = req.body;
        if (!imagesBase64 || !imagesBase64[0]) {
            return res.status(400).json({ error: "No image provided" });
        }

        // Use the most stable model directly
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent([
            "Analyze this item for market resale value. Provide identification, estimated value, and condition factors.",
            { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
        ]);

        const responseText = result.response.text();

        // Return the data directly. We removed Redis for a moment to ensure the core works.
        res.status(200).json({ candidates: [{ content: { parts: [{ text: responseText }] } }] });

    } catch (error) {
        console.error("Function Error:", error);
        res.status(500).json({ error: "Analysis failed. Please try again." });
    }
}
