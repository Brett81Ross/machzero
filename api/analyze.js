export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // We are using the 'v1beta' endpoint which is often required for the newest models
    // We are using 'gemini-1.5-flash' explicitly
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify this item and provide an estimated resale price range." },
            { inline_data: { mime_type: "image/jpeg", data: image } }
          ]
        }]
      })
    });
    
    const data = await response.json();
    
    // Check if Google returned a specific error
    if (data.error) {
        return res.status(500).json({ error: data.error.message });
    }
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
