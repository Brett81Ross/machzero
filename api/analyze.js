export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key not found in environment variables" });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Identify this item and provide an estimated resale price range." }, { inline_data: { mime_type: "image/jpeg", data: image } }] }]
      })
    });

    const data = await response.json();
    
    // Check if the API returned an error
    if (data.error) {
      return res.status(500).json({ error: "Google API Error: " + data.error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Server error: " + error.message });
  }
}
