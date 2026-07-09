export default async function handler(req, res) {
  // Only allow secure POST requests from your front-end button
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ========================================================
  // 🔑 PASTE YOUR REVERB PERSONAL ACCESS TOKEN BELOW HERE:
  // ========================================================
  const REVERB_TOKEN = "a1350a74e75826b0ecf03b1d6513c1b455022d5f60c130e35af0e698848c24ca"; 
  // ========================================================

  try {
    const { title, description, price } = req.body;

    // Clean up the price string to make sure it only contains numbers
    let cleanPrice = "0.00";
    if (price) {
      const numbersOnly = price.replace(/[^0-9.]/g, '');
      if (numbersOnly) {
        cleanPrice = parseFloat(numbersOnly).toFixed(2);
      }
    }

    // Securely forward the data payload straight to Reverb's server engine
    const reverbResponse = await fetch('https://api.reverb.com/api/listings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REVERB_TOKEN}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
        'Accept-Version': '3.0'
      },
      body: JSON.stringify({
        make: "Other", // Reverb requires a 'make' field, default to Other if unknown
        model: "Unknown",
        product_type: "guitars", // Default general category fallback
        condition: "Blemished",  // Safe default baseline condition category
        title: title,
        description: description,
        price: {
          amount: cleanPrice,
          currency: 'USD'
        },
        publish: false // Force the listing straight into your private draft folder
      })
    });

    if (reverbResponse.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errLog = await reverbResponse.json().catch(() => ({}));
      console.error("Reverb API Rejected Payload:", errLog);
      return res.status(reverbResponse.status).json({ 
        error: 'Reverb rejected the listing.', 
        details: errLog 
      });
    }
  } catch (err) {
    console.error("Serverless Backend Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
