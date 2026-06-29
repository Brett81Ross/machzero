import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image, images } = req.body;
    let imagesToProcess = [];

    if (images && Array.isArray(images)) {
      imagesToProcess = images;
    } else if (image) {
      imagesToProcess = [image];
    }

    if (imagesToProcess.length === 0) {
      return res.status(400).json({ error: 'Missing images data field payload' });
    }

    const contentParts = imagesToProcess.map(imgBase64 => {
      // Dynamic pattern matcher updated to catch modern webp raw format strings safely
      const matches = imgBase64.match(/^data:(image\/[a-z0-9]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Malformed image transmission layout format');
      }
      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2]
        }
      };
    });

    const appraisalPrompt = `You are an expert appraiser and high-end resale evaluator. 
Analyze the provided image configurations carefully. Use these multiple angles to check frame details, signature details, canvas texture, condition details, and overall scale.

Provide a definitive appraisal structure:
1. Estimated Resale Market Value Range ($ Min - Max Value)
2. Identified Item Title & Era/Year
3. Valuation Factors (Why it's worth this price point based on details or visible indicators)
4. Recommended Marketplace Channels (e.g., eBay, Mercari, specialty forums)

Be thorough, precise, and direct. If you cannot definitively authenticate the object from the snapshots, offer your best educated estimate based on visual marks.`;

    contentParts.push({ text: appraisalPrompt });

    // Explicit execution utilizing gemini-2.5-flash
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
