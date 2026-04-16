export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { system, user } = req.body;
  if (!system || !user) {
    return res.status(400).json({ error: 'system and user required' });
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    res.status(200).json({ text: data?.content?.[0]?.text || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
