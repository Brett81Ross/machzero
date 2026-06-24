import { GoogleGenerativeAI } from "@google/generative-ai";

// This securely reads your hidden key from Vercel's backend. Your actual key stays safe.
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.Gemini_API_Key_2;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Backend setup error: GEMINI_API_KEY environment token missing.' 
    });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Initialize the client securely using the hidden environment variable
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Configured precisely for the 3.5 model infrastructure
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      You are an expert appraiser and resale specialist. Analyze this image and provide a highly accurate market value estimation.
      Format the output clearly with:
      - Estimated Market Value Range
      - Item Identification & Details
      - Resale Market Analysis & Demand Level
    `;

    // Extract base64 data cleanly
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg"
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ analysis: text });
  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message 
    });
  }
}
