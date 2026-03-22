# CareXR Planet AI Backend

Vercel serverless backend for the CareXR solar system AR experience.

**Full voice pipeline:** Snap Spectacles ASR → Gemini AI → ElevenLabs TTS → spoken audio response

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ask` | POST | Receive question → Gemini answer → ElevenLabs audio |
| `/api/tts` | POST / GET | Convert any text to MP3 speech |

---

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
```bash
cd carexr-backend
git init && git add . && git commit -m "carexr planet ai"
```
Push to a new GitHub repo.

### 2. Deploy on Vercel
- Go to [vercel.com](https://vercel.com) → New Project → Import your repo
- Add environment variables:
  - `GEMINI_API_KEY` — from [aistudio.google.com](https://aistudio.google.com)
  - `ELEVENLABS_API_KEY` — from [elevenlabs.io](https://elevenlabs.io)
  - `ELEVENLABS_VOICE_ID` — optional (defaults to Adam voice `pNInz6obpgDQGcFmaJgB`)
- Deploy ✅

### 3. Test it

**Test AI + TTS combo:**
```bash
curl -X POST https://YOUR-APP.vercel.app/api/ask \
  -H "Content-Type: application/json" \
  -d '{"planet": "Mars", "question": "Why is Mars red?"}'
# Returns: { "answer": "...", "audioBase64": "..." }
```

**Test standalone TTS (saves MP3):**
```bash
curl "https://YOUR-APP.vercel.app/api/tts?text=Mars+is+red+because+of+iron+oxide" \
  --output test.mp3
```

---

## Lens Studio Setup

1. Copy `lens-studio/PlanetVoiceAI.ts` into a new TypeScript file in your Lens Studio project
2. Attach the script to a SceneObject
3. Create these objects in your scene:
   - A **Text** object for AI answers
   - A **Text** object for status messages ("Listening...", "Thinking...", "Speaking...")
   - A **SceneObject** with an **Audio Component** (leave Audio Track empty — the script sets it)
4. In the Inspector, set:
   - **Response Text** → the answer Text object
   - **Status Text** → the status Text object
   - **Audio Component** → the Audio Component for voice output
   - **Planet Name** → e.g. `"Mars"` (one script per planet)
   - **Backend Url** → `https://YOUR-APP.vercel.app` (no trailing slash)

### Voice Flow (what the user experiences)
```
User speaks → Spectacles ASR
→ Question sent to /api/ask
→ Gemini generates answer
→ ElevenLabs speaks the answer through Spectacles speakers
→ Answer text also shown on display
→ "Ask another question!" — loop restarts
```

---

## Notes

- No extra `npm install` needed — uses native Node.js 18+ `fetch` for ElevenLabs
- The `ask` endpoint is fault-tolerant: if ElevenLabs fails, the text answer still returns
- TTS uses `eleven_turbo_v2_5` for minimum latency (~1-2s generation time)
- Total round-trip latency target: ~3-5 seconds
