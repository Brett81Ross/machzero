export default async function handler(req, res) {
  // 1. Security: Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  // 2. Optimized Prompt for Analysis & Copy-Ready Listing Data
  const prompt = `
    Act as a professional luxury resale expert. Analyze this item and return the output in this exact markdown format:

    ### 📦 Item Identification
    [Provide a clear, accurate name and model of the item]

    ### 💰 Estimated Market Value
    [Provide a realistic price range in USD]

    ### 📝 Professional Resale Description
    [Write a compelling, SEO-friendly description suitable for an eBay or Poshmark listing.]

    ### 💡 Pro-Tips for Selling
    - [Tip 1: How to clean or prep the item]
    - [Tip 2: Best photos to take]
    - [Tip 3: Best platform or time to sell]

    ### 📋 Listing Data (Ready to Copy)
    Title: [Insert catchy title]
    Price: [Insert recommended price]
    Description: [Insert full description ready for copy/paste]
  `;

  try {
    // 3. API Call to Gemini 3.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();

    // 4. Robust Error Handling
    if (data.error) {
      return res.status(500).json({ error: "API Error: " + data.error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Server connection error: " + error.message });
  }
}
