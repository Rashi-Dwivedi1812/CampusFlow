from apscheduler.schedulers.background import BackgroundScheduler

from ai.daily_summary import clear_summary_cache

_scheduler = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(clear_summary_cache, "interval", minutes=5, id="clear_ai_cache")
    _scheduler.start()
