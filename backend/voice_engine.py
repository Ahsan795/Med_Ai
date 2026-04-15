"""
MediAI Voice Engine — Standalone Python STT/TTS module
Can be run independently for voice-only interaction with the health assistant.

Usage:
    python voice_engine.py
    python voice_engine.py --mode stt   # Speech-to-text only
    python voice_engine.py --mode tts --text "Hello patient"
"""

import os
import sys
import time
import threading
import argparse
import json
import io
from datetime import datetime

# ── Optional imports with graceful fallback ──────────────────────────────────
try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False
    print("⚠  SpeechRecognition not installed: pip install SpeechRecognition pyaudio")

try:
    from gtts import gTTS
    import pygame
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False
    print("⚠  gTTS/pygame not installed: pip install gTTS pygame")

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("⚠  Anthropic not installed: pip install anthropic")

# ── Text-to-Speech ────────────────────────────────────────────────────────────

class TTSEngine:
    """Multi-backend TTS: tries gTTS (online) then pyttsx3 (offline)."""

    def __init__(self, engine: str = "auto"):
        self.engine = engine
        self._pyttsx3_engine = None
        if PYTTSX3_AVAILABLE:
            try:
                self._pyttsx3_engine = pyttsx3.init()
                self._pyttsx3_engine.setProperty("rate", 175)
                self._pyttsx3_engine.setProperty("volume", 0.9)
            except Exception:
                self._pyttsx3_engine = None

    def _clean(self, text: str) -> str:
        """Remove markdown and API markers."""
        import re
        text = re.sub(r'\[.*?\]', '', text)
        text = re.sub(r'\*{1,2}(.*?)\*{1,2}', r'\1', text)
        text = re.sub(r'#{1,6}\s?', '', text)
        text = text.replace('•', '').replace('→', '').strip()
        return text[:600]  # cap for TTS

    def speak(self, text: str, lang: str = "en") -> bool:
        """Speak text. Returns True on success."""
        clean = self._clean(text)
        if not clean:
            return False

        # Try gTTS first (better quality)
        if GTTS_AVAILABLE and (self.engine in ("auto", "gtts")):
            try:
                tts = gTTS(text=clean, lang=lang, slow=False)
                buf = io.BytesIO()
                tts.write_to_fp(buf)
                buf.seek(0)

                pygame.mixer.init()
                pygame.mixer.music.load(buf)
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
                pygame.mixer.quit()
                return True
            except Exception as e:
                print(f"gTTS failed: {e}, falling back to pyttsx3")

        # Fallback: pyttsx3 (offline)
        if self._pyttsx3_engine and (self.engine in ("auto", "pyttsx3")):
            try:
                self._pyttsx3_engine.say(clean)
                self._pyttsx3_engine.runAndWait()
                return True
            except Exception as e:
                print(f"pyttsx3 failed: {e}")

        print(f"[TTS] {clean}")
        return False

    def save_mp3(self, text: str, filename: str = "output.mp3") -> str:
        """Save speech as MP3 file."""
        clean = self._clean(text)
        if GTTS_AVAILABLE:
            tts = gTTS(text=clean, lang="en", slow=False)
            tts.save(filename)
            return filename
        raise RuntimeError("gTTS required for saving MP3")


# ── Speech-to-Text ────────────────────────────────────────────────────────────

class STTEngine:
    """Microphone-based speech recognition with multiple backends."""

    def __init__(self, engine: str = "google"):
        self.engine = engine
        if SR_AVAILABLE:
            self.recognizer = sr.Recognizer()
            self.recognizer.energy_threshold = 4000
            self.recognizer.dynamic_energy_threshold = True
            self.recognizer.pause_threshold = 0.8
        else:
            self.recognizer = None

    def listen(self, timeout: int = 10, phrase_time_limit: int = 15) -> str | None:
        """Listen from microphone and return transcribed text."""
        if not SR_AVAILABLE:
            return input("(Voice unavailable) Type your message: ")

        with sr.Microphone() as source:
            print("🎤 Adjusting for ambient noise… ", end="", flush=True)
            self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
            print("Ready! Speak now.")
            try:
                audio = self.recognizer.listen(
                    source, timeout=timeout, phrase_time_limit=phrase_time_limit
                )
            except sr.WaitTimeoutError:
                print("⏰ Listening timed out.")
                return None

        return self._recognize(audio)

    def _recognize(self, audio) -> str | None:
        """Try multiple recognition backends."""
        backends = []
        if self.engine in ("google", "auto"):
            backends.append(("Google", lambda a: self.recognizer.recognize_google(a)))
        if self.engine in ("sphinx", "auto"):
            backends.append(("Sphinx", lambda a: self.recognizer.recognize_sphinx(a)))

        for name, fn in backends:
            try:
                text = fn(audio)
                print(f"✅ [{name}] Recognized: {text}")
                return text
            except sr.UnknownValueError:
                print(f"⚠  [{name}] Could not understand audio")
            except sr.RequestError as e:
                print(f"⚠  [{name}] Service error: {e}")
            except Exception as e:
                print(f"⚠  [{name}] Error: {e}")
        return None

    def listen_from_file(self, filepath: str) -> str | None:
        """Transcribe from an audio file."""
        if not SR_AVAILABLE:
            return None
        with sr.AudioFile(filepath) as source:
            audio = self.recognizer.record(source)
        return self._recognize(audio)


# ── Voice Chat Session ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are MediAI, a compassionate AI health assistant.
Keep responses concise (2-3 sentences max) since this is a voice interface.
Ask one question at a time. When you have enough information, provide a clear
assessment with: INITIAL STAGE / MEDIUM STAGE / HIGH STAGE.
For initial: give brief home care advice.
For medium/high: strongly recommend seeing a doctor and visiting a hospital."""

class VoiceChatSession:
    """Full voice-based conversation with the AI health assistant."""

    def __init__(self):
        self.tts = TTSEngine()
        self.stt = STTEngine()
        self.history = []
        self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY")) if ANTHROPIC_AVAILABLE else None

    def _chat(self, user_text: str) -> str:
        """Send message to Claude and get response."""
        if not self.client:
            return "AI service unavailable. Please set ANTHROPIC_API_KEY."

        self.history.append({"role": "user", "content": user_text})
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=self.history,
        )
        reply = response.content[0].text
        self.history.append({"role": "assistant", "content": reply})
        return reply

    def run(self):
        """Start the voice chat session."""
        print("\n" + "="*50)
        print("  MediAI Voice Assistant")
        print("  Say 'goodbye' or 'exit' to end the session")
        print("="*50 + "\n")

        # Welcome
        welcome = "Hello! I'm MediAI, your personal health assistant. How are you feeling today? Please tell me about any symptoms or health concerns."
        print(f"🩺 MediAI: {welcome}")
        self.tts.speak(welcome)

        while True:
            print("\n" + "-"*40)
            user_text = self.stt.listen()

            if not user_text:
                prompt = "I didn't catch that. Could you please repeat?"
                print(f"🩺 MediAI: {prompt}")
                self.tts.speak(prompt)
                continue

            print(f"👤 You: {user_text}")

            if any(w in user_text.lower() for w in ["goodbye", "bye", "exit", "quit", "stop"]):
                farewell = "Thank you for using MediAI. Please take care of your health. Goodbye!"
                print(f"🩺 MediAI: {farewell}")
                self.tts.speak(farewell)
                break

            reply = self._chat(user_text)
            print(f"🩺 MediAI: {reply}")
            self.tts.speak(reply)

        print("\nSession ended. Stay healthy! 💙")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="MediAI Voice Engine")
    parser.add_argument("--mode", choices=["stt", "tts", "chat", "test"], default="chat",
                        help="Operating mode")
    parser.add_argument("--text", type=str, default="Hello, I am MediAI your health assistant.",
                        help="Text to speak (for tts mode)")
    parser.add_argument("--file", type=str, help="Audio file to transcribe (for stt mode)")
    parser.add_argument("--engine", type=str, default="auto", help="TTS engine: auto|gtts|pyttsx3")
    args = parser.parse_args()

    if args.mode == "tts":
        print(f"Speaking: {args.text}")
        tts = TTSEngine(engine=args.engine)
        tts.speak(args.text)

    elif args.mode == "stt":
        stt = STTEngine()
        if args.file:
            result = stt.listen_from_file(args.file)
        else:
            result = stt.listen()
        print(f"Transcribed: {result}")

    elif args.mode == "test":
        print("=== MediAI Voice Engine Test ===")
        print(f"SpeechRecognition: {'✅' if SR_AVAILABLE else '❌'}")
        print(f"gTTS:              {'✅' if GTTS_AVAILABLE else '❌'}")
        print(f"pyttsx3:           {'✅' if PYTTSX3_AVAILABLE else '❌'}")
        print(f"Anthropic:         {'✅' if ANTHROPIC_AVAILABLE else '❌'}")
        print(f"API Key set:       {'✅' if os.getenv('ANTHROPIC_API_KEY') else '❌'}")
        if GTTS_AVAILABLE or PYTTSX3_AVAILABLE:
            print("\nTesting TTS...")
            tts = TTSEngine()
            tts.speak("MediAI voice engine test successful.")

    elif args.mode == "chat":
        session = VoiceChatSession()
        session.run()


if __name__ == "__main__":
    main()
