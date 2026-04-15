"""
MediAI Daily Health Check-in Scheduler
Sends desktop or terminal check-in reminders every 12 hours.
Run as a background process: python scheduler.py

Features:
  - Desktop notifications (cross-platform)
  - Terminal-based check-in if no GUI
  - Logs all responses to JSON
  - Integrates with voice engine for spoken check-ins
"""

import time
import json
import os
import sys
import platform
import threading
from datetime import datetime, timedelta
from pathlib import Path

# Notification backends
try:
    from plyer import notification as plyer_notify
    PLYER_AVAILABLE = True
except ImportError:
    PLYER_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

DATA_DIR = Path.home() / ".mediAI"
DATA_DIR.mkdir(exist_ok=True)
LOG_FILE = DATA_DIR / "checkin_log.json"
SCHEDULE_FILE = DATA_DIR / "schedule.json"

# ── Notification ──────────────────────────────────────────────────────────────

def send_notification(title: str, message: str):
    """Send desktop notification using best available method."""
    if PLYER_AVAILABLE:
        try:
            plyer_notify.notify(
                title=title, message=message,
                app_name="MediAI", timeout=10
            )
            return
        except Exception:
            pass

    system = platform.system()
    if system == "Darwin":
        os.system(f'osascript -e \'display notification "{message}" with title "{title}"\'')
    elif system == "Linux":
        os.system(f'notify-send "{title}" "{message}" 2>/dev/null || true')
    elif system == "Windows":
        try:
            from win10toast import ToastNotifier
            ToastNotifier().show_toast(title, message, duration=8)
        except Exception:
            pass

    print(f"\n🔔 [{title}] {message}")


# ── Check-in Logic ────────────────────────────────────────────────────────────

CHECKIN_QUESTIONS = [
    ("overall_feeling", "How are you feeling overall? (1=great, 2=good, 3=fair, 4=poor): ",
     {"1": "great", "2": "good", "3": "fair", "4": "poor"}),
    ("sleep_quality", "How was your sleep? (1=excellent, 2=good, 3=fair, 4=poor): ",
     {"1": "excellent", "2": "good", "3": "fair", "4": "poor"}),
    ("pain_level", "Any pain today? (1=none, 2=mild, 3=moderate, 4=severe): ",
     {"1": "none", "2": "mild", "3": "moderate", "4": "severe"}),
    ("energy_level", "Energy level? (1=high, 2=normal, 3=low, 4=very low): ",
     {"1": "high", "2": "normal", "3": "low", "4": "very low"}),
]

def run_checkin_terminal() -> dict:
    """Run interactive terminal check-in."""
    print("\n" + "="*50)
    print("  🩺 MediAI Daily Health Check-in")
    print(f"  {datetime.now().strftime('%A, %B %d %Y  %I:%M %p')}")
    print("="*50)

    responses = {}
    for key, prompt, mapping in CHECKIN_QUESTIONS:
        while True:
            raw = input(prompt).strip()
            if raw in mapping:
                responses[key] = mapping[raw]
                break
            print(f"  Please enter one of: {', '.join(mapping.keys())}")

    score = _calculate_score(responses)
    _save_checkin(responses, score)

    print(f"\n✅ Check-in complete! Health score: {score}%")
    _print_advice(score, responses)
    return responses


def _calculate_score(responses: dict) -> int:
    weights = {
        "great": 100, "excellent": 100, "high": 100,
        "good": 75, "normal": 75, "none": 100,
        "fair": 50, "low": 40, "mild": 60,
        "poor": 25, "very low": 20, "moderate": 35, "severe": 10,
    }
    values = [weights.get(v, 50) for v in responses.values()]
    return round(sum(values) / len(values)) if values else 50


def _print_advice(score: int, responses: dict):
    print()
    if score >= 80:
        print("💚 You're doing great! Keep up your healthy habits.")
    elif score >= 60:
        print("💛 Decent day. Focus on rest and hydration.")
    elif score >= 40:
        print("🧡 Some concerns noted. Consider consulting MediAI or a doctor.")
    else:
        print("❤️  Several health concerns. Please use MediAI chat or see a doctor soon.")

    if responses.get("pain_level") in ("moderate", "severe"):
        print("⚠️  Pain detected — consider checking our MediAI chat for guidance.")
    if responses.get("sleep_quality") == "poor":
        print("💤 Poor sleep affects health. Aim for 7-9 hours tonight.")


def _save_checkin(responses: dict, score: int):
    entry = {
        "timestamp": datetime.now().isoformat(),
        "responses": responses,
        "health_score": score,
    }
    history = []
    if LOG_FILE.exists():
        try:
            history = json.loads(LOG_FILE.read_text())
        except Exception:
            pass
    history.append(entry)
    LOG_FILE.write_text(json.dumps(history[-100:], indent=2))  # keep last 100

    # Also POST to backend if running
    if REQUESTS_AVAILABLE:
        try:
            requests.post(
                "http://localhost:8000/api/checkin",
                json={"user_id": "local_user", "responses": responses},
                timeout=2
            )
        except Exception:
            pass


# ── Scheduler ─────────────────────────────────────────────────────────────────

def load_schedule() -> datetime:
    if SCHEDULE_FILE.exists():
        try:
            data = json.loads(SCHEDULE_FILE.read_text())
            return datetime.fromisoformat(data["next_checkin"])
        except Exception:
            pass
    return datetime.now()


def save_schedule(next_time: datetime):
    SCHEDULE_FILE.write_text(json.dumps({"next_checkin": next_time.isoformat()}))


def scheduler_loop(interval_hours: float = 12):
    """Main scheduler loop. Runs indefinitely."""
    print(f"🕐 MediAI Scheduler started (every {interval_hours}h)")
    print(f"📁 Data stored in: {DATA_DIR}")
    print("   Press Ctrl+C to stop.\n")

    next_checkin = load_schedule()

    while True:
        now = datetime.now()
        if now >= next_checkin:
            send_notification(
                "MediAI Health Check-in 🩺",
                "Time for your daily health check-in! Open your terminal."
            )
            time.sleep(2)  # small delay after notification
            run_checkin_terminal()
            next_checkin = datetime.now() + timedelta(hours=interval_hours)
            save_schedule(next_checkin)
            print(f"\n⏰ Next check-in: {next_checkin.strftime('%I:%M %p, %b %d')}\n")

        # Sleep until next check (check every minute)
        time.sleep(60)


# ── Entry ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="MediAI Daily Check-in Scheduler")
    parser.add_argument("--interval", type=float, default=12,
                        help="Check-in interval in hours (default: 12)")
    parser.add_argument("--once", action="store_true",
                        help="Run a single check-in now and exit")
    parser.add_argument("--history", action="store_true",
                        help="Show check-in history and exit")
    args = parser.parse_args()

    if args.history:
        if LOG_FILE.exists():
            history = json.loads(LOG_FILE.read_text())
            print(f"\n📊 MediAI Check-in History ({len(history)} entries)\n")
            for entry in history[-10:]:
                ts = datetime.fromisoformat(entry["timestamp"]).strftime("%b %d %I:%M %p")
                score = entry.get("health_score", "?")
                feeling = entry["responses"].get("overall_feeling", "?")
                print(f"  {ts}  |  Score: {score}%  |  Feeling: {feeling}")
        else:
            print("No check-in history found.")
        sys.exit(0)

    if args.once:
        run_checkin_terminal()
        sys.exit(0)

    try:
        scheduler_loop(interval_hours=args.interval)
    except KeyboardInterrupt:
        print("\n\nScheduler stopped. Stay healthy! 💙")
