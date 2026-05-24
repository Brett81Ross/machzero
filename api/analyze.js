export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        const { imageBase64 } = req.body;
        console.log("Backend triggered...");

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Server Error: API Key missing in Vercel settings" });
        }

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

        const data = await response.json();
        console.log("AI Response received:", JSON.stringify(data).substring(0, 100));

        if (!response.ok) {
            return res.status(500).json({ error: "Gemini API Error: " + JSON.stringify(data.error) });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Critical Backend Error:", error.message);
        res.status(500).json({ error: "Critical Error: " + error.message });
    }
}
