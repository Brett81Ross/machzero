export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        const { imageBase64 } = req.body;
        
        // This log will show up in your Vercel logs to confirm it triggered
        console.log("Analyze API hit"); 

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
        
        if (!response.ok) {
            // This captures the error from Google directly
            return res.status(500).json({ error: data.error?.message || "Google API Error" });
        }

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
