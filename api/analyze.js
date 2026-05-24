export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    try {
        const { imageBase64 } = req.body;
        
        // 1. Verify API Key exists
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Missing GEMINI_API_KEY environment variable");
        }

        // 2. Make request
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Write a marketplace listing. Format: TITLE, PRICE, DESCRIPTION, CONDITION, WHERE TO SELL." },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        // 3. Get response
        const data = await response.json();
        
        // 4. If Google returned an error, send it back as the error message
        if (!response.ok) {
            throw new Error(data.error?.message || "Google API returned an error");
        }

        res.status(200).json(data);
    } catch (error) {
        // This will now show the REAL error on your phone screen
        res.status(500).json({ error: error.message });
    }
}
