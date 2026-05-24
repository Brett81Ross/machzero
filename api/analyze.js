export default async function handler(req, res) {
    // 1. Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { image } = req.body;

    if (!image) {
        return res.status(400).json({ error: 'No image provided' });
    }

    try {
        // 2. Get your Gemini API key from Vercel's Environment Variables
        const apiKey = process.env.GEMINI_API_KEY; 
        
        if (!apiKey) {
            return res.status(500).json({ error: 'API key is missing in Vercel.' });
        }

        // 3. Talk to the Gemini AI
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: "Analyze this item for resale. What is it, its condition, and its estimated market value?" },
                            {
                                inlineData: {
                                    mimeType: "image/jpeg",
                                    data: image
                                }
                            }
                        ]
                    }
                ]
            })
        });

        const data = await geminiResponse.json();

        // 4. Handle AI errors
        if (!geminiResponse.ok) {
            console.error("Gemini API Error:", data);
            return res.status(500).json({ error: 'Failed to communicate with Gemini AI.' });
        }

        // 5. Send the AI's answer back to your frontend
        return res.status(200).json(data);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server crashed while analyzing the image.' });
    }
}
