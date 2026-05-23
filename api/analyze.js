export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const prompt = `
    Act as a professional resale expert. Analyze this image and provide:
    1. ### 📦 Item Identification: Name and model.
    2. ### 💰 Estimated Market Value: Price range in USD.
    3. ### 🔗 Live Market Comparisons: Provide 3-5 links to similar items online.
    4. ### 📝 Professional Resale Description: SEO-friendly for eBay/Poshmark.
    5. ### 💡 Pro-Tips for Selling: 3 tips on cleaning, photos, and platforms.
    6. ### 📋 Listing Data (Ready to Copy): Title, Price, and Description formatted for easy copying.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tools: [{ google_search_retrieval: {} }],
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }]
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
