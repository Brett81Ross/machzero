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

    // 1. Dynamic Brand & Model Extraction
    let make = "Other";
    let model = "Acoustic Guitar";
    let productType = "acoustic-guitars"; // Accurate fallback for acoustic strings

    const cleanTitle = title ? title.replace(/\[\/?PART_[0-9]\]/g, '').trim() : "Musical Instrument Asset";
    const lowerTitle = cleanTitle.toLowerCase();

    // Scan for major brands to satisfy Reverb's core payload requirements
    const brandList = ['gibson', 'ibanez', 'fender', 'epiphone', 'martin', 'taylor', 'prs', 'yamaha', 'gretsch', 'squier'];
    const foundBrand = brandList.find(b => lowerTitle.includes(b));
    
    if (foundBrand) {
      make = foundBrand.charAt(0).toUpperCase() + foundBrand.slice(1);
      // Strip out the brand name to extract a cleaner model representation
      model = cleanTitle.replace(new RegExp(foundBrand, 'gi'), '').trim();
    }

    // 2. Dynamic Category Mapping Matrix
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

    // 3. Clean up the price string to isolate numerical values
    let cleanPrice = "0.00";
    if (price) {
      const numbersOnly = price.replace(/[^0-9.]/g, '');
      if (numbersOnly) {
        // If it's a range (like 120-200), grab the first complete number set
        const components = numbersOnly.split('.');
        cleanPrice = parseFloat(components[0]).toFixed(2);
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
        condition: "Used", // "Used" is a standard universally accepted baseline state string
        title: cleanTitle,
        description: description || "See photos for product condition details.",
        price: {
          amount: cleanPrice,
          currency: 'USD'
        },
        publish: false // Lands securely inside your private draft folder configuration
      })
    });

    if (reverbResponse.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errLog = await reverbResponse.json().catch(() => ({}));
      console.error("Reverb API Error Payload Return:", errLog);
      return res.status(reverbResponse.status).json({ 
        error: 'Reverb rejected the parameters.', 
        details: errLog 
      });
    }
  } catch (err) {
    console.error("Serverless Backend Endpoint Exception:", err);
    return res.status(500).json({ error: err.message });
  }
}
