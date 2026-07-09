export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ========================================================
  // 🔑 PASTE YOUR REVERB PERSONAL ACCESS TOKEN BELOW HERE:
  // ========================================================
  const REVERB_TOKEN = "a1350a74e75826b0ecf03b1d6513c1b455022d5f60c130e35af0e698848c24ca"; 
  // ========================================================

  try {
    const { title, description, price, images } = req.body;

    // 1. Sanitize the incoming title string
    let cleanTitle = title ? title.replace(/\[\/?PART_[0-9]\]/g, '').trim() : "Musical Instrument Asset";
    cleanTitle = cleanTitle.replace(/\*\*/g, '');
    const lowerTitle = cleanTitle.toLowerCase();

    // 2. Isolate Brand (Make) and Model parameters
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

    // 4. UNBROKEN PRICING CONTEXT REGEX TOKENIZER
    let cleanPrice = "150.00"; 
    if (price) {
      const genericNumbers = price.replace(/[^0-9.\-]/g, '');
      const primarySegment = genericNumbers.split('-')[0];
      
      if (primarySegment && !isNaN(primarySegment)) {
        cleanPrice = parseFloat(primarySegment).toFixed(2);
      }
    }

    // 5. Unbroken clean layout description copy block pass-through
    let cleanDescription = "See photos for product condition details.";
    if (description) {
      cleanDescription = description
        .replace(/\[\/?PART_[0-9]\]/g, '') 
        .replace(/\*\*/g, '')              
        .replace(/\\n/g, '\n') 
        .trim();
    }

    // 6. Step A: Initial Content Payload Save Handoff to Reverb
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
          uuid: "df268ad1-c462-4ba6-b6db-e007e23922ea" // Standard UUID mapping for "Excellent"
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

    if (!reverbResponse.ok) {
      const errLog = await reverbResponse.json().catch(() => ({}));
      return res.status(reverbResponse.status).json({ error: 'Reverb rejected draft text data.', details: errLog });
    }

    const successfulListingData = await reverbResponse.json();
    
    // 7. Step B: Two-Step Async Child Image Upload Sequencing Loop
    const imageUploadEndpoint = successfulListingData._links?.['reverb:listing_images']?.href 
      || `https://api.reverb.com/api/listings/${successfulListingData.id}/images`;

    if (images && Array.isArray(images) && images.length > 0 && imageUploadEndpoint) {
      for (const b64Data of images) {
        try {
          await fetch(imageUploadEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${REVERB_TOKEN}`,
              'Content-Type': 'application/json',
              'Accept': 'application/hal+json',
              'Accept-Version': '3.0'
            },
            body: JSON.stringify({
              file: `data:image/jpeg;base64,${b64Data}`
            })
          });
        } catch (imgErr) {
          console.error("Single child image payload asset upload dropout failed:", imgErr);
        }
      }
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Serverless Backend Endpoint Failure:", err);
    return res.status(500).json({ error: err.message });
  }
}
