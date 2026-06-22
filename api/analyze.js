const { GoogleGenAI } = require('@google/genai');

module.exports = async function handler(req, res) {
    // Enable global CORS headers for mobile browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight options checks
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'System configuration error: Missing API Key.' });
        }

        const { image, mimeType } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // Clean raw base64 data string
        const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

        const ai = new GoogleGenAI({ apiKey: apiKey });

        // Using the official Gemini 3.5 Flash production model string
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
                {
                    inlineData: {
                        data: cleanBase64,
                        mimeType: mimeType || 'image/jpeg'
                    }
                },
                'You are an expert appraiser tool named MachZero. Analyze the provided image of the item and generate a concise breakdown detailing its estimated resale market value, condition indicators, and whether it is a buy, sell, or pass.'
            ]
        });

        if (!response || !response.text) {
            throw new Error('Empty payload returned from the engine.');
        }

        return res.status(200).json({ result: response.text });

    } catch (error) {
        console.error('Serverless crash details:', error.message);
        return res.status(500).json({ error: 'Analysis failed during backend invocation.' });
    }
};
