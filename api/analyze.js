async function analyzeImage() {
    const btn = document.getElementById('analyzeBtn');
    const res = document.getElementById('result');
    
    // Step 1: Tell the user exactly what is happening
    btn.disabled = true;
    res.innerHTML = `
        <div style="text-align: left; opacity: 0.8;">
            <p><strong>Step 1:</strong> Scanning image features...</p>
            <p><strong>Step 2:</strong> Identifying brand and model...</p>
            <p><strong>Step 3:</strong> Searching live market data...</p>
            <p><strong>Step 4:</strong> Generating your listing description...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/analyze', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ image: resizedBase64 })
        });
        const data = await response.json();
        
        if (!data.candidates) throw new Error("AI analysis failed.");

        let text = data.candidates[0].content.parts[0].text;
        
        // Clean and format the output
        text = text.replace(/###\s/g, '').replace(/📦 Item Identification/g, '<h3>📦 Item Identification</h3>')
                   .replace(/💰 Estimated Market Value/g, '<h3>💰 Estimated Market Value</h3>')
                   .replace(/🔗 Live Market Comparisons/g, '<div class="links-box"><h3>🔗 Live Market Comparisons</h3>')
                   .replace(/📝 Professional Resale Description/g, '</div><div class="desc-box"><h3>📝 Professional Resale Description</h3>')
                   .replace(/💡 Pro-Tips for Selling/g, '</div><div class="tips-box"><h3>💡 Pro-Tips for Selling</h3>')
                   .replace(/📋 Listing Data/g, '</div><div class="listing-data-box"><h3>📋 Listing Data</h3>') + '</div>';
        
        res.innerHTML = text.replace(/\n/g, '<br>');
        document.getElementById('copyBtn').style.display = 'block';
        
    } catch (err) {
        res.innerHTML = "<b>Error:</b> " + err.message + "<br>Please try taking a clearer photo.";
    } finally {
        btn.innerText = "🔍 Get Value"; 
        btn.disabled = false;
    }
}
