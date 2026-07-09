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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // The explicit appraisal prompt unified with frontend parsing logic
    const prompt = `You are an expert appraiser and high-end resale evaluator. 
Analyze the provided image configurations carefully. Use these multiple angles to check frame details, signature details, canvas texture, condition details, and overall scale.

Proactively calculate and deduce the estimated physical dimensions of the object based on contextual clues, perspective, aspect ratio, and object classification. Do not prompt the user for sizing information.

Provide your output using this exact text layout pattern below. Do not omit the structural divider anchors [PART_1], [PART_2], [PART_3], [PART_4], and [PART_5] as they are parsed out programmatically by the interface engine.

[PART_1]
(Provide ONLY the raw Estimated Resale Market Value Range here, e.g. $150 - $200)

[PART_2]
(Provide ONLY the raw Identified Item Title & Era/Year here)

[PART_3]
(Provide a thorough Markdown bulleted list of the Valuation Factors here)

[PART_4]
(Provide a thorough Markdown list of the Recommended Marketplace Channels here)

[PART_5]
(Provide exactly what to copy and paste into a sale ad here. Generate a polished description featuring calculated measurements, condition specifics, and target keywords)

Be thorough, precise, and direct.`;

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
