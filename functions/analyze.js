export async function onRequestPost(context) {
    const { request, env } = context;

  const GROQ_API_KEY = env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
          return new Response(
                  JSON.stringify({ error: "API Key 未設定，請聯絡總部管理員。" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
                );
    }

  let body;
    try {
          body = await request.json();
    } catch {
          return new Response(
                  JSON.stringify({ error: "請求格式錯誤。" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
                );
    }

  const { situation, store } = body;
    if (!situation || situation.trim().length < 5) {
          return new Response(
                  JSON.stringify({ error: "請輸入完整的情境描述。" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
                );
    }

  const systemPrompt = `你是一位熟悉台灣勞動法規的承攬關係合規顧問，協助各行業判斷承攬關係中的法律風險。分析是否存在「假承攬真僱傭」的風險。七大核心地雷：1.指揮監督權 2.工具材料提供 3.場所限制 4.費用承擔 5.人身專屬性 6.名稱矛盾 7.固定報酬。風險等級：high=高風險、medium=中風險、low=低風險。只回覆純JSON物件，不加任何說明文字、不加markdown、不加think標籤：{"riskLevel":"high","riskTitle":"風險核心","triggeredItems":[{"item":"地雷名稱","reason":"觸犯原因"}],"whyRisky":"白話說明","suggestions":["建議1","建議2","建議3"],"needHQ":true,"needHQReason":"原因","documents":["文件1"]}`;
    const userMessage = `單位名稱：${store || "未填寫"}\n情境描述：${situation}`;

  try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                          model: "openai/gpt-oss-20b",
                          max_tokens: 1024,
                          temperature: 0.1,
                          reasoning_effort: "low",
                          messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userMessage },
                                    ],
                }),
        });

      if (!response.ok) {
              const err = await response.text();
              console.error("Groq API error:", err);
              return new Response(
                        JSON.stringify({ error: "AI 分析服務暫時無法使用，請稍後再試。" }),
                { status: 502, headers: { "Content-Type": "application/json" } }
                      );
      }

      const data = await response.json();
        const raw = data.choices?.[0]?.message?.content || "";

      let cleaned = raw;
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
        cleaned = cleaned.replace(/```json/gi, "");
        cleaned = cleaned.replace(/```/g, "");
        cleaned = cleaned.trim();

      const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start === -1 || end === -1) {
                throw new Error("No JSON found in response");
        }
        cleaned = cleaned.substring(start, end + 1);
        const result = JSON.parse(cleaned);

      return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json" },
      });
  } catch (err) {
        console.error("Function error:", err);
        return new Response(
                JSON.stringify({ error: "分析過程發生錯誤，請重新嘗試。" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
              );
  }
}
