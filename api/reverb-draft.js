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
    cleanTitle = cleanTitle.replace(/\*\*/g, '');
    const lowerTitle = cleanTitle.toLowerCase();

    // 2. Isolate Brand (Make) and Model strictly according to Reverb guidelines
    let make = "Other";
    let model = cleanTitle;
    let productType = "acoustic-guitars"; 

    const brandList = ['Gibson', 'Ibanez', 'Fender', 'Epiphone', 'Martin', 'Taylor', 'PRS', 'Yamaha', 'Gretsch', 'Squier'];
    const foundBrand = brandList.find(b => lowerTitle.includes(b.toLowerCase()));
    
    if (foundBrand) {
      make = foundBrand;
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

    // 4. BULLETPROOF FIX: Price-Specific Tokenizer (Ignores Year Text like 2000s/2010s)
    let cleanPrice = "0.00";
    if (price) {
      // RegEx target: Finds standard currency notations (e.g., $1,500, $250.00, 1500)
      const currencyMatch = price.match(/\$?([1-9]\d{2,}(?:[\.,]\d{2})?)/);
      
      if (currencyMatch && currencyMatch[1]) {
        // Strip out any commas so parseFloat can process it cleanly
        const rawNumbers = currencyMatch[1].replace(/,/g, '');
        if (rawNumbers && !isNaN(rawNumbers)) {
          cleanPrice = parseFloat(rawNumbers).toFixed(2);
        }
      } else {
        // Fallback catch-all if no standard currency format matches
        const backupMatch = price.match(/\d[\d,.]*/);
        if (backupMatch && backupMatch[0]) {
          const rawNumbers = backupMatch[0].replace(/,/g, '');
          if (rawNumbers && !isNaN(rawNumbers)) {
            cleanPrice = parseFloat(rawNumbers).toFixed(2);
          }
        }
      }
    }

    // 5. Clean description formatting for clean ingest parameters
    let cleanDescription = "See photos for product condition details.";
    if (description) {
      cleanDescription = description
        .replace(/\[\/?PART_[0-9]\]/g, '') 
        .replace(/\*\*/g, '')              
        .replace(/\\n/g, ' ')              
        .replace(/\n/g, ' ')               
        .replace(/\s+/g, ' ')              
        .trim();
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
        condition: {
          uuid: "df268ad1-c462-4ba6-b6db-e007e23922ea" // Standard UUID for "Excellent"
        },
        title: cleanTitle.substring(0, 80), 
        description: cleanDescription,
        price: {
          amount: cleanPrice,
          currency: 'USD'
        },
        location: {
          country_code: "US"
        },
        has_inventory: true,
        inventory: 1,
        publish: false 
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
