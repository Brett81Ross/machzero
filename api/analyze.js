import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `
You are a professional reseller and appraisal expert.

Analyze ALL uploaded photos together.

Determine:

1. Item Identification
2. Brand
3. Model
4. Estimated Age
5. Condition Grade
6. Confidence Score
7. Estimated Dimensions
8. eBay Price
9. Mercari Price
10. Facebook Marketplace Price
11. OfferUp Price
12. Reverb Price if applicable
13. Best Selling Platforms
14. SEO Listing Title
15. Professional Description

Output EXACT JSON:

{
 "title":"",
 "brand":"",
 "model":"",
 "condition":"",
 "confidence":"",
 "dimensions":"",
 "valueRange":"",
 "ebay":"",
 "mercari":"",
 "facebook":"",
 "offerup":"",
 "reverb":"",
 "bestPlatforms":[],
 "description":"",
 "factors":[]
}
`;

    const parts = [
      ...images.map(img => ({
        inlineData: {
          data: img,
          mimeType: "image/jpeg"
        }
      })),
      prompt
    ];

    const result = await model.generateContent(parts);

    const text = result.response.text();

    return res.status(200).json({
      success: true,
      raw: text
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
