export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
  if (!image) return res.status(400).json({ error: 'No image data received.' });

  const prompt = `Act as a resale expert. Analyze this image. Return the output in this format:
### 📦 Item Identification
[Name/Model]
### 💰 Estimated Market Value
[Price range USD]
### 🔗 Live Market Comparisons
[Provide 3-5 links to similar listings]
### 📝 Professional Resale Description
[SEO-friendly description]
### 💡 Pro-Tips for Selling
- [3 tips]
### 📋 Listing Data
Title: [Title]
Price: [Price]
Description: [Description for copy/paste]`;

  try {
    // Corrected to gemini-3.5-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "Gemini API request failed.");
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
