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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Analyze this item and provide: 1. Description, 2. Estimated Market Value, 3. Suggested Resale Price, 4. Best place to sell/list,  4. Exactly What to copy and paste in selling ad/post in marketplace. " },
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
