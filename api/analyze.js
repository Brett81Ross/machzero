export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
    
    try {
        const { imageBase64 } = req.body;
        const MODEL = "gemini-3.5-flash"; 
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [
                    { text: `Analyze the item in the image. Generate a professional listing and sales strategy. 
                    
Return ONLY this formatted text (no intro or outro):

[TITLE]
(Write a catchy, optimized title here)

[PRICE]
(Suggested price)

[DESCRIPTION]
(Write a detailed description: what it is, key features, exact condition, and why it is a great buy. Keep it professional.)

[CONDITION]
(New / Used - Excellent / Good / Fair)

[WHERE TO SELL & WHY]
(List the top 2 platforms and provide a 1-sentence explanation for each on why it will sell fast there.)

---` },
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
