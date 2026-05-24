export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
    
    try {
        const { imageBase64 } = req.body;
        // Using the 3.5-Flash model as requested
        const MODEL = "gemini-3.5-flash"; 
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [
                    { text: `Analyze the item in the image and write a listing. Output ONLY the text exactly as it should appear in a marketplace selling post. Do not include any intro, outro, or conversation.

TITLE:
[Enter a catchy, searchable title here]

PRICE:
$[Enter price]

DESCRIPTION:
[Start with what the item is. Then, list 3-5 specific physical features. Finally, write a brief, persuasive paragraph on why someone needs to buy this item.]

CONDITION:
[New / Used - Condition Details]

WHERE TO SELL:
[List 2 platforms and a 1-sentence reason for each]` },
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
