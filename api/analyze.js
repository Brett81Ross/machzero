export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const { imageBase64 } = req.body;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `Act as an expert reseller. Create a high-converting marketplace listing for the provided item. 
Provide the output in this exact, clean format:

TITLE: [Write a catchy, optimized title]
PRICE: [Suggest a competitive local market price]
CONDITION: [Specify condition clearly]
WHERE TO SELL: [Suggest the best platform: e.g., Facebook Marketplace, eBay, Poshmark]

--- COPY AND PASTE BELOW THIS LINE ---
[Write a professional, persuasive ad description ready for a buyer to read. Include features, benefits, and call to action.]
---` },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(500).json({ error: data.error?.message || "Gemini API Error" });
        }
        
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
