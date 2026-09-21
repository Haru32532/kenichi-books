export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'kenichi-books-ai', keyConfigured: Boolean(process.env.OPENAI_API_KEY) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POSTで呼び出してください。' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY がVercelに設定されていません。' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const question = String(body.question || '').trim();
    if (!question) return res.status(400).json({ error: '質問を入力してください。' });
    const contextText = JSON.stringify(body.context || {}).slice(0, 80000);
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        store: false,
        input: [
          { role: 'system', content: 'あなたは「けんいちくんの本棚」の児童書アシスタントです。与えられた蔵書、読み聞かせ履歴、くもん推薦図書のデータを優先して、日本語で簡潔かつ具体的に回答してください。データにない所有状況、中古相場、レア度、版情報は推測で断定しないでください。' },
          { role: 'user', content: `質問:\n${question}\n\n本棚データ:\n${contextText}` }
        ]
      })
    });
    const raw = await upstream.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!upstream.ok) {
      const m = data?.error?.message || raw.slice(0, 500) || `OpenAI API error (${upstream.status})`;
      let cat = 'OpenAI APIエラー';
      if (upstream.status === 401) cat = 'APIキー認証エラー';
      else if (upstream.status === 429) cat = 'API利用枠・請求設定エラー';
      else if (/model/i.test(m)) cat = 'AIモデル設定エラー';
      return res.status(upstream.status).json({ error: `${cat}: ${m}` });
    }
    const text = data.output_text || (data.output || []).flatMap(x => x?.content || []).filter(x => x?.type === 'output_text').map(x => x?.text || '').join('\n').trim();
    if (!text) return res.status(502).json({ error: 'OpenAIから回答本文を取得できませんでした。' });
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: `Vercel Functionエラー: ${e?.message || String(e)}` });
  }
}
