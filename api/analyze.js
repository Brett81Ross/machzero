const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

const handler = async function (req, res) {
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      You are an expert appraiser and resale specialist. Analyze this image and provide a highly accurate market value estimation.
      Format the output clearly with:
      - Estimated Market Value Range
      - Item Identification & Details
      - Resale Market Analysis & Demand Level
    `;

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    // Explicit format structured for thinking/multimodal requests
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
    // Sends the real Google API error string directly back to the app UI
    return res.status(500).json({ 
      error: error.message || 'Analysis failed'
    });
  }
};

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};
