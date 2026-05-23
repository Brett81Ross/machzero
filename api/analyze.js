export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!image) return res.status(400).json({ error: 'No image provided' });

  // Simplified prompt to ensure reliability
  const prompt = `
    Act as a professional resale expert. Analyze this image and provide:
    1. Item Identification (Name/Model)
    2. Estimated Market Value (Price range in USD)
    3. Professional Resale Description (SEO-friendly)
    4. Pro-Tips for Selling (3 bullet points)
    5. Listing Data (Title, Price, Description ready for copy/paste)
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }]
      })
    });

    const data = await response.json();
    
    // Log the actual error to your Vercel logs if it fails
    if (!data.candidates) {
        console.error("API Response Data:", JSON.stringify(data));
        return res.status(500).json({ error: "API did not return candidates. Check logs." });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
