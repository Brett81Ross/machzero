export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    // 1. Verify API Key exists before doing anything
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server Configuration Error: GEMINI_API_KEY is missing." });
    }

    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: "No image data provided." });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Write a Facebook Marketplace listing for this item using this format: TITLE, PRICE, DESCRIPTION, CONDITION, WHERE TO SELL." },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        const result = await response.json();

        // 2. Log if Gemini itself returned an error
        if (result.error) {
            console.error("Gemini API Error Details:", JSON.stringify(result.error));
            return res.status(500).json({ error: "Gemini API rejected request: " + result.error.message });
        }

        res.status(200).json(result);
    } catch (error) {
        // 3. Log the catch block error
        console.error("Caught Exception:", error.message);
        res.status(500).json({ error: "System error: " + error.message });
    }
}
