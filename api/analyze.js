export default async function handler(req, res) {
    const { imageBase64, user_id } = req.body;

    // 1. Check scan count in Supabase
    const { data: userRecord } = await supabase
        .from('user_scans')
        .select('count')
        .eq('user_id', user_id)
        .single();

    const currentCount = userRecord ? userRecord.count : 0;

    // 2. The 7-scan limit
    if (currentCount >= 7) {
        return res.status(403).json({ error: "Free scans used up for this month." });
    }

    // 3. ... [Perform Gemini Analysis Here] ...

    // 4. If successful, increment count
    await supabase
        .from('user_scans')
        .update({ count: currentCount + 1 })
        .eq('user_id', user_id);

    return res.status(200).json(geminiResult);
}
