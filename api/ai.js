export default async function handler(req, res) {
  // 診断用：ブラウザで /api/ai を直接開いた場合
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      functionReady: true,
      keyConfigured: Boolean(process.env.OPENAI_API_KEY)
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEYがVercelに設定されていません。"
    });
  }

  try {
    const body = req.body || {};

    const question =
      body.question ||
      body.message ||
      body.prompt ||
      body.input ||
      "";

    const context =
      body.context ||
      body.library ||
      body.books ||
      "";

    if (!question) {
      return res.status(400).json({
        error: "質問内容がありません。"
      });
    }

    const systemText = `
あなたは「けんいちくんの本棚」の読書アシスタントです。
ユーザーが登録した蔵書、読み聞かせ記録、くもん推薦図書などの情報を参考に、
日本語で具体的かつ簡潔に回答してください。

蔵書データに存在しない本を「所有している」と断定しないでください。
不明なことは不明と伝えてください。
`;

    const userText =
      typeof context === "string"
        ? `${question}\n\n参考データ:\n${context}`
        : `${question}\n\n参考データ:\n${JSON.stringify(context)}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5",
        instructions: systemText,
        input: userText
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI APIとの通信でエラーが発生しました。"
      });
    }

    const answer =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        ?.find(item => item.type === "output_text")
        ?.text ||
      "AIから回答を取得できませんでした。";

    return res.status(200).json({
      ok: true,
      answer,
      text: answer
    });

  } catch (error) {
    console.error("AI function error:", error);

    return res.status(500).json({
      error: error?.message || "AI接続エラー"
    });
  }
}
