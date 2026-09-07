export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { file, resolution } = req.body;
    const apiToken = process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
        return res.status(500).json({ error: 'REPLICATE_API_TOKEN is missing on Vercel.' });
    }

    try {
        // Replicate AI model call for video/media processing
        const response = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json",
                "Prefer": "wait"
            },
            body: JSON.stringify({
                version: "cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4",
                input: {
                    image: file,
                    upscale: 4
                }
            })
        });

        const textResponse = await response.text();
        let prediction;
        
        try {
            prediction = JSON.parse(textResponse);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid response from AI server: ' + textResponse.substring(0, 100) });
        }

        if (prediction.error) {
            return res.status(500).json({ error: prediction.error });
        }

        let outputUrl = prediction.output;
        let statusUrl = prediction.urls?.get;
        let status = prediction.status;
        
        while (status !== 'succeeded' && status !== 'failed' && statusUrl) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const pollRes = await fetch(statusUrl, {
                headers: { "Authorization": `Bearer ${apiToken}` }
            });
            const pollData = await pollRes.json();
            status = pollData.status;
            if (status === 'succeeded') {
                outputUrl = pollData.output;
            } else if (status === 'failed') {
                throw new Error('AI processing failed.');
            }
        }

        return res.status(200).json({ output: outputUrl });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
