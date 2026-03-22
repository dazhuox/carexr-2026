const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ElevenLabs config — use a warm, friendly voice (Adam is a good default)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Adam voice

const SYSTEM_PROMPT = `You are a friendly, enthusiastic space educator speaking to children and teens aged 10-17.
You are part of an AR solar system experience on smart glasses. The student is looking at a planet and asking you a question about it.

Rules:
- Keep answers to 2-3 sentences maximum (they will be read aloud AND displayed on AR glasses)
- Use simple, exciting language that sparks curiosity
- Include one surprising or "wow" fact when possible
- If the question is unrelated to space/science, gently redirect: "Great question! But while we're exploring space, did you know that..."
- Never use markdown formatting, bullet points, or special characters — plain text only
- Do not use asterisks, dashes, or any symbols — only letters, numbers, commas, periods, and exclamation marks`;

async function generateSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY not set");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5", // fastest model — best for real-time AR
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${err}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer).toString("base64");
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { planet, question } = req.body;

    if (!planet || !question) {
      return res.status(400).json({ error: "Missing planet or question" });
    }

    // Step 1: Gemini generates the answer
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nThe student is currently looking at: ${planet}\nTheir question: ${question}`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7,
      },
    });

    const answer = result.response.text();

    // Step 2: ElevenLabs converts the answer to audio (best-effort — don't fail if TTS fails)
    let audioBase64 = null;
    try {
      audioBase64 = await generateSpeech(answer);
    } catch (ttsError) {
      console.error("TTS failed (answer still returned):", ttsError.message);
    }

    return res.status(200).json({
      answer,
      audioBase64, // null if TTS failed — Lens should handle gracefully
    });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({
      error: "AI service unavailable",
      detail: error.message || String(error),
    });
  }
};
