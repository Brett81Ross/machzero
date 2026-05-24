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
                    { text: `You are an expert resale appraiser. Analyze the item in the image and provide a highly detailed, professional listing.

Format the output exactly as follows:

TITLE: [Catchy, descriptive title including brand, model, and key keywords - 60 chars max]

PRICE: $[Suggested Price based on market value]

DESCRIPTION:
1. WHAT IT IS: [Detailed physical description: materials, design, key features, color, size]
2. CONDITION REPORT: [Detailed assessment: list any visible wear, tear, or signs of use; emphasize if it is pristine/like-new]
3. SELLING POINTS: [Why a buyer wants this specific item; emphasize benefits/use-cases]

CONDITION: [New/Used - Good/Fair/etc]

SALES STRATEGY:
- Recommended Platforms: [List platforms like Facebook Marketplace, eBay, OfferUp, Poshmark, etc.]
- Rationale: [Why these specific platforms will result in the fastest sale for this item type]

---
Provide ONLY the text above.` },
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
