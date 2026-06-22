const { GoogleGenAI } = require('@google/genai');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'System config error: Missing GEMINI_API_KEY environment variable.' });
        }

        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data payload received.' });
        }

        const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

        const ai = new GoogleGenAI({ apiKey: apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
                {
                    inlineData: {
                        data: cleanBase64,
                        mimeType: 'image/jpeg'
                    }
                },
                'You are an expert appraiser tool named MachZero. Analyze the provided image of the item and generate a concise breakdown detailing its estimated resale market value, condition indicators, and whether it is a buy, sell, or pass.'
            ]
        });

        if (!response || !response.text) {
            throw new Error('AI Engine returned an empty evaluation response stream.');
        }

        return res.status(200).json({ result: response.text });

    } catch (error) {
        return res.status(500).json({ error: 'Backend Server Exception: ' + error.message });
    }
};
