export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key is missing in server settings' });
    }

    try {
        const { imagesBase64 } = req.body;
        
        if (!imagesBase64 || !Array.isArray(imagesBase64)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // Updated prompt to force the 6-point format
        const prompt = `Analyze this item and provide exactly these 6 points. Do not include introductory text.
        1. Estimated Market Value: [Value]
        2. Average Profit: [Amount]
        3. Sell Speed: [Fast/Medium/Slow]
        4. Confidence: [Percentage]
        5. Description: [Thorough but brief description]
        6. Listing Text: [A catchy title and short description ready to copy/paste into eBay, Mercari, Poshmark, Depop, and FB Marketplace]`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: imagesBase64[0] } }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
