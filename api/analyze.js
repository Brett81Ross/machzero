import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Gracefully handle both legacy single strings and arrays
    const { image, images } = req.body;
    let imagesToProcess = [];

    if (images && Array.isArray(images)) {
      imagesToProcess = images;
    } else if (image) {
      imagesToProcess = [image];
    }

    if (imagesToProcess.length === 0) {
      return res.status(400).json({ error: 'Missing image assets payload array' });
    }

    // Convert data URLs into pure format structures acceptable by the API SDK
    const contentParts = imagesToProcess.map(imgBase64 => {
      const matches = imgBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Malformed base64 transmission layout detected');
      }
      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2]
        }
      };
    });

    const appraisalPrompt = `You are an expert appraiser and high-end resale evaluator. 
Analyze the provided image context configurations carefully. If multiple images are presented, use them to inspect different details, labels, condition details, or angles of the same item.

Provide a definitive appraisal structure:
1. Identified Item Title & Era/Year
2. Estimated Resale Market Value Range ($ Min - Max Value)
3. Valuation Factors (Why it's worth this price point based on details or visible indicators)
4. Recommended Marketplace Channels (e.g., eBay, Mercari, specialty forums)

Be thorough, precise, and direct. If you cannot definitively authenticate the object from the snapshots, offer your best educated estimate based on visual marks.`;

    // Append instructions right inside the model array loop
    contentParts.push({ text: appraisalPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentParts,
    });

    return res.status(200).json({ analysis: response.text });
  } catch (error) {
    console.error("Gemini API Error Pipeline Failure:", error);
    return res.status(500).json({ 
      error: 'Analysis Engine Failure', 
      details: error.message 
    });
  }
}
