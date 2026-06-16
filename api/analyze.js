import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { imagesBase64 } = req.body;

        const systemInstruction = `
        You are the MachZero AI resale expert. You have exhaustive knowledge of:
        1. Numismatics: Global coins, historical currency, rare banknotes, and mint marks.
        2. Sports Memorabilia: All major league trading cards (Baseball, Football, Basketball, Soccer, Hockey), rookie cards, and graded card value factors.
        3. Trading Card Games (TCG): Pokémon, Magic: The Gathering, Yu-Gi-Oh!, and other collectible card games, including set variations, rarities, and condition grading.
        
        When a user uploads an image, analyze it for identifying features like set codes, serial numbers, or grading markers. Provide:
        - Precise identification of the item.
        - An estimated resale value range based on current market trends.
        - Essential tips on factors (condition, grading, scarcity) that impact its value.
        Keep responses concise, professional, and actionable for resellers.
        `;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.5",
            systemInstruction: systemInstruction
        });

        const imagePart = {
            inlineData: {
                data: imagesBase64[0],
                mimeType: "image/jpeg"
            }
        };

        const result = await model.generateContent([
            "Analyze this item for market resale value.",
            imagePart
        ]);

        const responseText = result.response.text();
        res.status(200).json({
            candidates: [{
                content: {
                    parts: [{ text: responseText }]
                }
            }]
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).send("An error occurred during analysis: " + error.message);
    }
}
