import { GoogleGenAI } from '@google/genai';

// Initialize the Google Gen AI SDK using your environment API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Vercel serverless functions require a default exported handler function
export default async function handler(req, res) {
    // Ensure we are only accepting POST requests for the analysis
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { image, mimeType } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image data found in request payload.' });
        }

        // Clean up the base64 string if the frontend sends the data URL prefix
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType || 'image/jpeg'
            },
        };

        const systemPrompt = `You are an expert appraiser tool named MachZero. Analyze the provided image of the item and generate a concise breakdown detailing its estimated resale market value, condition indicators, and whether it is a buy, sell, or pass.`;

        // Explicitly targeting the live stable Gemini 3.5 Flash production model
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [systemPrompt, imagePart]
        });

        if (!response || !response.text) {
            throw new Error('Empty response payload returned from Gemini API.');
        }

        return res.status(200).json({ result: response.text });

    } catch (error) {
        console.error('Serverless Analysis Error:', error.message);
        return res.status(500).json({ error: 'Analysis failed. Please try again.' });
    }
}
