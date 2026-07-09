import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini SDK securely on the server using your environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Enforce POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { images } = req.body;

    // Validation: Ensure images were actually sent in the payload
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided for analysis." });
    }

    // Format the incoming base64 strings into the structure the Gemini SDK expects
    const imageParts = images.map((base64Str) => {
      const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, "");
      return {
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg",
        },
      };
    });

    // TARGETING THE NEW 3.5 FLASH MODEL FOR IMPROVED CODING/REASONING SPEED
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    // The explicit appraisal prompt for MachZero
    const prompt = `
      Analyze the provided item images carefully. 
      Provide a highly accurate valuation, including estimated market resale price range, 
      item condition analysis, identifying marks/signatures, and rough dimensional estimates if visible.
      Format the final response in clean markdown structure.
    `;

    // Fire the request off securely
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Send the data back to your frontend UI
    return res.status(200).json({ 
      success: true, 
      analysis: text 
    });

  } catch (error) {
    console.error("Backend MachZero Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal server error during image appraisal processing." 
    });
  }
}
