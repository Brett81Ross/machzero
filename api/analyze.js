import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { imagesBase64 } = req.body;

        if (!imagesBase64 || !imagesBase64[0]) {
            return res.status(400).send("No image provided.");
        }

        // Using the 3.5-flash model for streamlined analysis
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const result = await model.generateContent([
            "Analyze this item for market resale value. Provide identification, estimated value, and condition factors.",
            { inlineData: { data: imagesBase64[0], mimeType: "image/jpeg" } }
        ]);

        const responseText = result.response.text();

        // Return the raw text directly to the app
        res.status(200).json({ 
            candidates: [{ content: { parts: [{ text: responseText }] } }] 
        });
    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).send("Server Error: " + error.message);
    }
}
