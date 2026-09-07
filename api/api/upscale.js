export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { videoUrl, resolution } = req.body;
    const apiToken = process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
        return res.status(500).json({ error: 'REPLICATE_API_TOKEN is missing.' });
    }

    try {
        const response = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json",
                "Prefer": "wait"
            },
            body: JSON.stringify({
                version: "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf4161069f738c4d79",
                input: {
                    img: videoUrl,
                    scale: 4
                }
            })
        });

        const textRes = await response.text();
        let data;
        try {
            data = JSON.parse(textRes);
        } catch (e) {
            return res.status(500).json({ error: 'Server response error: ' + textRes.substring(0, 80) });
        }

        if (data.error) {
            return res.status(500).json({ error: data.error });
        }

        let outputUrl = data.output;
        let statusUrl = data.urls?.get;
        let status = data.status;
        
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
