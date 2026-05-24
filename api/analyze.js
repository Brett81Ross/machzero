export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: "Method not allowed"});

    try {
        const { imageBase64 } = req.body;
        // Using 1.5-flash as the fallback model to ensure stability
        const MODEL = "gemini-1.5-flash"; 
        const API_KEY = process.env.GEMINI_API_KEY;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Write a marketplace listing for this item. Use format: TITLE, PRICE, DESCRIPTION, CONDITION, WHERE TO SELL." },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data.candidates) {
            return res.status(200).json(data);
        } else {
            console.error("Gemini Error:", JSON.stringify(data));
            return res.status(500).json({ error: "Gemini did not return candidates" });
        }
    } catch (error) {
        console.error("Server Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
