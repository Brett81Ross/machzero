export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
    
    try {
        const { imageBase64 } = req.body;
        // Using the most advanced current production model identifier
        const MODEL = "gemini-1.5-pro-002"; 
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [
                    { text: "Analyze this item for resale: title, condition, and estimated value." },
                    { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                ]}]
            })
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Backend error: " + error.message });
    }
}
