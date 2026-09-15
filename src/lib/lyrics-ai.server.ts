// Server-only: ask Lovable AI Gateway to propose LRC timestamps for plain lyrics.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function suggestLrc(plainLyrics: string, durationSeconds: number): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");

  const mins = Math.floor(durationSeconds / 60);
  const secs = Math.round(durationSeconds % 60);
  const durationLabel = durationSeconds > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : "unknown";

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You add LRC timestamps to song lyrics. Output ONLY lyric lines, each starting with a timestamp in the form [MM:SS.xx] followed by a space and the original line text. Keep the original wording, order and line breaks exactly. Timestamps must be strictly increasing, start after a short intro, and the last line must end before the song duration. No commentary, no blank lines, no metadata tags, no code fences.",
        },
        {
          role: "user",
          content: `Song duration: ${durationLabel} (${Math.round(durationSeconds)} seconds).\nDistribute the lines naturally across the song.\n\nLyrics:\n${plainLyrics}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI_RATE_LIMITED");
    if (res.status === 402) throw new Error("AI_CREDITS_EXHAUSTED");
    throw new Error(`AI_REQUEST_FAILED_${res.status}: ${body.slice(0, 200)}`);
  }

  // Accumulate SSE deltas server-side; nothing streams to the browser.
  const reader = res.body?.getReader();
  if (!reader) throw new Error("AI_EMPTY_RESPONSE");
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        out += json.choices?.[0]?.delta?.content ?? "";
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  return cleanLrc(out);
}

/** Drop code fences and any line that is not a timestamped lyric line. */
export function cleanLrc(raw: string): string {
  return raw
    .replace(/```[a-z]*\n?/gi, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\]/.test(l))
    .join("\n");
}
