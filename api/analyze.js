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
            return res.status(500).json({ error: 'Backend setup error: GEMINI_API_KEY environment token missing.' });
        }

        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Missing target data payload asset.' });
        }

        const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const apiPayload = {
            contents: [{
                parts: [
                    { text: "You are an expert appraiser tool named MachZero. Analyze the provided image of the item and generate a concise breakdown detailing its estimated resale market value, condition indicators, and whether it is a buy, sell, or pass." },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: cleanBase64
                        }
                    }
                ]
            }]
        };

        const aiResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload)
        });

        const aiData = await aiResponse.json();

        if (!aiResponse.ok || !aiData.candidates || aiData.candidates.length === 0) {
            return res.status(aiResponse.status).json({ 
                error: aiData.error?.message || 'The Gemini engine failed to process this specific image matrix.' 
            });
        }

        const evaluationText = aiData.candidates[0].content.parts[0].text;
        return res.status(200).json({ result: evaluationText });

    } catch (error) {
        return res.status(500).json({ error: 'Core server exception handler tripped: ' + error.message });
    }
};
