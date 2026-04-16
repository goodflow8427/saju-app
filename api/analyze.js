export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { system, user } = req.body;
  if (!system || !user) return res.status(400).json({ error: 'required' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
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
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: d });
    res.status(200).json({ text: d?.content?.[0]?.text || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
