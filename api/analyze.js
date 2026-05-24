export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const { imageBase64 } = req.body;
        const MODEL = "gemini-3.5-flash"; 
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Analyze the item in the image. Output ONLY the text exactly as it should appear in a marketplace listing. Format: TITLE, PRICE, DESCRIPTION, CONDITION, WHERE TO SELL." },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            res.status(200).json(data);
        } else {
            // This is the line that will tell you what's wrong in the logs
            console.error("API Error Log:", JSON.stringify(data));
            res.status(500).json({ error: "No data returned" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
