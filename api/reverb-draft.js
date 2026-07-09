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

    // 1. Defensively sanitize the input title string
    let cleanTitle = title ? title.replace(/\[\/?PART_[0-9]\]/g, '').trim() : "Musical Instrument Asset";
    // Strip out markdown formatting symbols like asterisks
    cleanTitle = cleanTitle.replace(/\*\*/g, '');
    const lowerTitle = cleanTitle.toLowerCase();

    // 2. Isolate Brand (Make) and Model strictly according to Reverb guidelines
    let make = "Other";
    let model = cleanTitle;
    let productType = "acoustic-guitars"; // Accurate fallback for acoustic instruments

    // Common brand identification strings matching Reverb endpoints
    const brandList = ['Gibson', 'Ibanez', 'Fender', 'Epiphone', 'Martin', 'Taylor', 'PRS', 'Yamaha', 'Gretsch', 'Squier'];
    const foundBrand = brandList.find(b => lowerTitle.includes(b.toLowerCase()));
    
    if (foundBrand) {
      make = foundBrand;
      // Strip the manufacturer out of the model parameter so it doesn't double-up
      model = cleanTitle.replace(new RegExp(foundBrand, 'gi'), '').trim();
    }

    // 3. Dynamic Category Mapping Matrix
    if (lowerTitle.includes('electric') && lowerTitle.includes('guitar')) {
      productType = "electric-guitars";
    } else if (lowerTitle.includes('bass')) {
      productType = "bass-guitars";
    } else if (lowerTitle.includes('amplifier') || lowerTitle.includes('amp')) {
      productType = "amps";
    } else if (lowerTitle.includes('pedal') || lowerTitle.includes('effects')) {
      productType = "effects-and-pedals";
    } else if (lowerTitle.includes('synth') || lowerTitle.includes('keyboard')) {
      productType = "keyboards-and-synths";
    }

    // 4. Robust Price Extraction Loop
    let cleanPrice = "0.00";
    if (price) {
      // Remove commas and dollar signs, keep numbers and decimals
      const numericalString = price.replace(/[^0-9.\-]/g, '');
      // If it's a range (e.g. 1500-2000), split and pull the lower baseline threshold number
      const parts = numericalString.split('-');
      const targetNumber = parts[0] ? parts[0].split('.')[0] : "0";
      
      if (targetNumber && !isNaN(targetNumber)) {
        cleanPrice = parseFloat(targetNumber).toFixed(2);
      }
    }

    // Securely forward the dynamic data payload straight to Reverb's server engine
    const reverbResponse = await fetch('https://api.reverb.com/api/listings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REVERB_TOKEN}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
        'Accept-Version': '3.0'
      },
      body: JSON.stringify({
        make: make,
        model: model || "Instrument Asset",
        product_type: productType,
        condition: "Excellent", // Must be one of Reverb's exact structural strings
        title: cleanTitle.substring(0, 80), // Reverb limits title headers to 80 characters
        description: description || "See photos for product condition details.",
        price: {
          amount: cleanPrice,
          currency: 'USD'
        },
        location: {
          country_code: "US"
        },
        has_inventory: true,
        inventory: 1,
        publish: false // Forces the payload into your private unpublished draft section
      })
    });

    if (reverbResponse.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errLog = await reverbResponse.json().catch(() => ({}));
      console.error("Reverb API Rejected Parameters directly:", errLog);
      return res.status(reverbResponse.status).json({ 
        error: 'Reverb rejected parameters.', 
        details: errLog 
      });
    }
  } catch (err) {
    console.error("Serverless Backend Endpoint Failure:", err);
    return res.status(500).json({ error: err.message });
  }
}
