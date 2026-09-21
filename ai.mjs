export default {
  async fetch(request) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POSTで呼び出してください。' }), { status: 405, headers });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY がVercelに設定されていません。' }), { status: 503, headers });
    }

    try {
      const body = await request.json();
      const question = String(body?.question || '').trim();
      if (!question) {
        return new Response(JSON.stringify({ error: '質問を入力してください。' }), { status: 400, headers });
      }

      // Keep the request compact enough for reliable serverless execution.
      const contextText = JSON.stringify(body?.context || {}).slice(0, 120000);
      const payload = {
        model: process.env.OPENAI_MODEL || 'gpt-5',
        store: false,
        input: [
          {
            role: 'system',
            content: 'あなたは「けんいちくんの本棚」の児童書アシスタントです。与えられた蔵書、読み聞かせ履歴、くもん推薦図書のデータを優先して、日本語で簡潔かつ具体的に回答してください。データにない所有状況、中古相場、レア度、版情報は推測で断定しないでください。'
          },
          {
            role: 'user',
            content: `質問:\n${question}\n\n本棚データ:\n${contextText}`
          }
        ]
      };

      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const raw = await upstream.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

      if (!upstream.ok) {
        const apiMessage = data?.error?.message || `OpenAI API error (${upstream.status})`;
        let category = 'OpenAI APIエラー';
        if (upstream.status === 401) category = 'APIキー認証エラー';
        else if (upstream.status === 429) category = 'API利用枠・請求設定エラー';
        else if (/model/i.test(apiMessage)) category = 'AIモデル設定エラー';
        return new Response(JSON.stringify({ error: `${category}: ${apiMessage}`, status: upstream.status }), { status: upstream.status, headers });
      }

      const text = data?.output_text || (data?.output || [])
        .flatMap(item => item?.content || [])
        .filter(item => item?.type === 'output_text')
        .map(item => item?.text || '')
        .join('\n')
        .trim();

      if (!text) {
        return new Response(JSON.stringify({ error: 'OpenAIから回答本文を取得できませんでした。' }), { status: 502, headers });
      }

      return new Response(JSON.stringify({ text }), { status: 200, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: `Vercel Functionエラー: ${error?.message || String(error)}` }), { status: 500, headers });
    }
  }
};
