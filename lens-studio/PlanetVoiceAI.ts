// PlanetVoiceAI.ts — Full voice AI pipeline for CareXR Solar System
// Paste this into a new TypeScript file in Lens Studio and attach to a SceneObject.
//
// Required scene setup:
//   1. An Audio Component on a SceneObject (for AI voice output)
//   2. A Text component for the AI answer display
//   3. A Text component for status messages (optional but recommended)
//
// Inspector inputs:
//   - responseText   → Text component to display AI answers
//   - statusText     → Text component for status ("Listening...", "Speaking...", etc.)
//   - audioComponent → Audio Component that will speak the AI response
//   - planetName     → String, e.g. "Mars"
//   - backendUrl     → Your Vercel URL, e.g. "https://your-app.vercel.app"

@component
export class PlanetVoiceAI extends BaseScriptComponent {
  @input
  @hint("Text component to display AI responses")
  responseText: Text;

  @input
  @hint("Text component to show status (Listening / Thinking / Speaking)")
  statusText: Text;

  @input
  @hint("Audio Component that will play the AI voice response")
  audioComponent: AudioComponent;

  @input
  @hint("Name of the planet the user is looking at (e.g. Mars)")
  planetName: string = "Earth";

  @input
  @hint("Your Vercel backend base URL (no trailing slash)")
  backendUrl: string = "https://YOUR-APP.vercel.app";

  // Snap SDK modules
  private asrModule = require("LensStudio:AsrModule");
  private remoteService = require("LensStudio:RemoteServiceModule");
  private remoteMedia = require("LensStudio:RemoteMediaModule");

  private isProcessing: boolean = false;

  onAwake(): void {
    this.setStatus("Ask me about " + this.planetName + "!");
    this.startListening();
  }

  // ─── ASR ─────────────────────────────────────────────────────────────────

  private startListening(): void {
    const options = AsrModule.AsrTranscriptionOptions.create();
    options.silenceUntilTerminationMs = 1500;
    options.mode = AsrModule.AsrMode.HighAccuracy;

    options.onTranscriptionUpdateEvent.add((eventArgs) => {
      if (eventArgs.isFinal && eventArgs.text.trim().length > 0) {
        // Ignore new questions while the previous one is still processing
        if (this.isProcessing) {
          print("Still processing previous question — ignoring new input");
          return;
        }
        print("User asked: " + eventArgs.text);
        this.handleQuestion(eventArgs.text.trim());
      } else if (!eventArgs.isFinal && !this.isProcessing) {
        // Show live transcription so user knows it's hearing them
        this.setStatus("🎤 " + eventArgs.text);
      }
    });

    options.onTranscriptionErrorEvent.add((errorCode) => {
      print("ASR Error: " + errorCode);
      this.setStatus("Voice error — try again");
      this.isProcessing = false;
    });

    this.asrModule.startTranscribing(options);
    print("PlanetVoiceAI: Listening for voice input on " + this.planetName);
  }

  // ─── Pipeline: Question → Gemini → ElevenLabs TTS ────────────────────────

  private handleQuestion(question: string): void {
    this.isProcessing = true;
    this.setStatus("Thinking...");

    const req = RemoteServiceModule.createRequest(this.backendUrl + "/api/ask");
    req.method = RemoteServiceModule.HttpRequestMethod.Post;
    req.setHeader("Content-Type", "application/json");
    req.body = JSON.stringify({
      planet: this.planetName,
      question: question,
    });

    this.remoteService.performRequest(req, (response) => {
      try {
        const data = JSON.parse(response.body);

        // Always display the text answer
        if (data.answer && this.responseText) {
          this.responseText.text = data.answer;
        }

        if (data.answer) {
          // Play via /api/tts endpoint (returns raw MP3)
          this.speakAnswer(data.answer);
        } else {
          this.setStatus("Hmm, I couldn't hear that — try again!");
          this.isProcessing = false;
        }
      } catch (e) {
        print("PlanetVoiceAI parse error: " + e);
        if (this.responseText) {
          this.responseText.text = "Couldn't get an answer. Try again!";
        }
        this.setStatus("Ask me about " + this.planetName + "!");
        this.isProcessing = false;
      }
    });
  }

  // ─── Audio Playback ───────────────────────────────────────────────────────

  private speakAnswer(answerText: string): void {
    this.setStatus("Speaking...");

    // Encode the text for a URL query param
    const encoded = encodeURIComponent(answerText);
    const ttsUrl = this.backendUrl + "/api/tts?text=" + encoded;

    // Step 1: Create a DynamicResource from the TTS audio URL
    const resource = RemoteServiceModule.makeResourceFromUrl(ttsUrl);

    // Step 2: Load it as an AudioTrackAsset
    this.remoteMedia.loadResourceAsAudioTrackAsset(
      resource,
      (audioTrack) => {
        // Success — assign to the Audio Component and play
        if (this.audioComponent) {
          this.audioComponent.audioTrack = audioTrack;
          this.audioComponent.play(1); // play once
          print("PlanetVoiceAI: Playing AI voice response");
        } else {
          print("PlanetVoiceAI: No AudioComponent set — skipping playback");
        }

        // Reset after a reasonable time (based on typical answer length ~5s)
        // In production, hook into audioComponent.onFinish if available
        const script = this.getSceneObject().getComponent("Component.ScriptComponent");
        const delayEvent = script
          ? null
          : null; // placeholder — use Delay script event if needed

        this.setStatus("Ask another question!");
        this.isProcessing = false;
      },
      (error) => {
        // TTS audio failed — still show text, just no voice
        print("PlanetVoiceAI audio load error: " + error);
        this.setStatus("Ask another question!");
        this.isProcessing = false;
      }
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private setStatus(msg: string): void {
    if (this.statusText) {
      this.statusText.text = msg;
    }
    print("PlanetVoiceAI status: " + msg);
  }
}
