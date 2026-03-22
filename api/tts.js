// Standalone TTS endpoint
// POST /api/tts  { text: "string to speak" }
// Returns raw MP3 audio with Content-Type: audio/mpeg
// The Snap Spectacles Lens can use this URL with RemoteServiceModule.makeResourceFromUrl()

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Adam voice

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Allow GET for easy testing: /api/tts?text=Hello+World
  const text =
    req.method === "GET" ? req.query?.text : req.body?.text;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Missing or empty 'text' field" });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
  }

  try {
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elResponse.ok) {
      const errText = await elResponse.text();
      console.error("ElevenLabs error:", errText);
      return res
        .status(502)
        .json({ error: `ElevenLabs returned ${elResponse.status}` });
    }

    const audioBuffer = await elResponse.arrayBuffer();

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.byteLength);
    // Cache for 5 minutes — same question/answer won't regenerate audio
    res.setHeader("Cache-Control", "public, max-age=300");

    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("TTS handler error:", error);
    return res.status(500).json({ error: "TTS service unavailable" });
  }
};
