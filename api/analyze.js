export default async function handler(req, res) {
    console.log("API Route Hit!"); // This will show up in Vercel Logs
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }
    
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is missing from Vercel!");
            return res.status(500).json({ error: "Configuration Error" });
        }

        const { imageBase64 } = req.body;
        console.log("Sending request to Gemini...");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [
                    { text: "Analyze this item." },
                    { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                ]}]
            })
        });

        const data = await response.json();
        console.log("Gemini Response received.");
        res.status(200).json(data);
        
    } catch (error) {
        console.error("Caught error:", error);
        res.status(500).json({ error: "Backend failed: " + error.message });
    }
}
