import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // Enable CORS headers so your frontend app can communicate seamlessly
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight OPTIONS request from the browser
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'System Configuration Error: Missing API Key.' });
        }

        const { image, mimeType } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // Handle stripping the base64 prefix if passed from a mobile upload stream
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType || 'image/jpeg'
                    }
                },
                'You are an expert appraiser tool named MachZero. Analyze the provided image of the item and generate a concise breakdown detailing its estimated resale market value, condition indicators, and whether it is a buy, sell, or pass.'
            ]
        });

        if (!response || !response.text) {
            throw new Error('Invalid response structure returned from API.');
        }

        return res.status(200).json({ result: response.text });

    } catch (error) {
        console.error('Serverless Execution Crash:', error.message);
        return res.status(500).json({ error: 'Analysis failed during system execution.' });
    }
}
