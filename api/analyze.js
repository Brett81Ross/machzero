export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const { imageBase64 } = req.body;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 second limit

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Write a marketplace listing. Format: TITLE, PRICE, DESCRIPTION, CONDITION, WHERE TO SELL." },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        clearTimeout(timeout);
        const data = await response.json();
        
        if (data.candidates) {
            return res.status(200).json(data);
        } else {
            return res.status(500).json({ error: "No response from AI" });
        }
    } catch (error) {
        return res.status(500).json({ error: error.name === 'AbortError' ? "Timed out" : error.message });
    }
}
