export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { system, user } = req.body;
  if (!system || !user) return res.status(400).json({ error: 'required' });
  
  // 재시도 로직 (429, 529 오류 대응)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000 * attempt));
      
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      
      // 429, 529 오류면 재시도
      if (r.status === 429 || r.status === 529) {
        if (attempt < 2) continue;
        return res.status(r.status).json({ error: '잠시 후 다시 시도해주세요.' });
      }
      
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d });
      return res.status(200).json({ text: d?.content?.[0]?.text || '' });
      
    } catch (e) {
      if (attempt === 2) return res.status(500).json({ error: e.message });
    }
  }
}
