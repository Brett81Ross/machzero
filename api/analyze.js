export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s hard limit

    try {
        const { imageBase64 } = req.body;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                "contents": [{
                    "parts": [
                        { "text": "Write a marketplace listing. Format: TITLE, PRICE, DESCRIPTION, CONDITION, WHERE TO SELL." },
                        { "inline_data": { "mime_type": "image/jpeg", "data": imageBase64 } }
                    ]
                }]
            })
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        clearTimeout(timeoutId);
        res.status(500).json({ error: error.name === 'AbortError' ? "Timed out - AI took too long" : error.message });
    }
}
