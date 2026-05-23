        async function analyzeImage() {
            const btn = document.getElementById('analyzeBtn');
            const res = document.getElementById('result');
            
            // Define the steps to show the user
            const steps = [
                "Identifying item...",
                "Calculating market value...",
                "Drafting resale description...",
                "Generating pro-selling tips...",
                "Finalizing your report..."
            ];
            
            btn.disabled = true;
            res.style.display = 'block';
            
            // Cycle through the steps
            let i = 0;
            const interval = setInterval(() => {
                btn.innerText = steps[i];
                i = (i + 1) % steps.length;
            }, 1500);
            
            try {
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: resizedBase64 })
                });
                
                const data = await response.json();
                clearInterval(interval); // Stop the text rotation
                
                if (data.candidates && data.candidates[0].content.parts[0].text) {
                    res.innerHTML = data.candidates[0].content.parts[0].text.replace(/\n/g, '<br>');
                    res.scrollIntoView({ behavior: 'smooth' });
                } else {
                    res.innerText = "Error: Could not process image.";
                }
            } catch (err) {
                clearInterval(interval);
                res.innerText = "Connection Error: " + err.message;
            } finally {
                btn.innerText = "🔍 Get Value";
                btn.disabled = false;
            }
        }
