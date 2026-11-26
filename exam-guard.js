
/* ExamPrep Studio — Exam Guard */

window.ExamGuard = (() => {
    let active = false;
    let locked = false;
    let onViolation = null;
    let onReturn = null;

    const telegram = window.Telegram?.WebApp;

    let focusTimer = null;
    let resizeTimer = null;
    let baseline = null;
    let fullscreenSeen = false;
    let telegramFullscreenSeen = false;
    const android = /Android/i.test(navigator.userAgent);
    const dimensions = () => ({ w: window.innerWidth, h: window.innerHeight });
    function typing() {
        const el = document.activeElement;
        return !!el && (el.matches('input, textarea, select') || el.isContentEditable);
    }
    function clearTimers() {
        clearTimeout(focusTimer);
        clearTimeout(resizeTimer);
    }
    function requestFullScreen() {
        try {
            if (telegram && typeof telegram.requestFullscreen === 'function' &&
                (!telegram.isVersionAtLeast || telegram.isVersionAtLeast('8.0'))) {
                telegram.requestFullscreen();
            } else if (document.fullscreenEnabled && !document.fullscreenElement) {
                document.documentElement.requestFullscreen?.()?.catch(() => {});
            }
        } catch (_) { /* Fullscreen is optional on unsupported clients. */ }
    }
    function detectViolation(reason) {
        if (!active || locked) return;

        locked = true;
        onViolation?.(reason);
    }

    function handleReturn() {
        if (!active) return;
        onReturn?.();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            detectViolation("page_hidden");
        } else {
            handleReturn();
        }
    });

    window.addEventListener("pagehide", () => {
        detectViolation("page_left");
    });

    window.addEventListener("pageshow", handleReturn);

    // Android assistant overlays sometimes steal focus without hiding the page.
    window.addEventListener('blur', () => {
        if (!active || locked || !android) return;
        clearTimeout(focusTimer);
        focusTimer = setTimeout(() => {
            if (!document.hasFocus() && !typing()) detectViolation('window_blur');
        }, 700);
    });
    window.addEventListener('focus', () => {
        clearTimeout(focusTimer);
        handleReturn();
    });
    window.addEventListener('resize', () => {
        if (!active || locked || !android || !baseline) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!active || locked || !baseline) return;
            const now = dimensions();
            // Ignore orientation changes and keyboard-related height changes.
            if ((now.w > now.h) !== (baseline.w > baseline.h)) {
                baseline = now;
                return;
            }
            if (now.w < baseline.w * 0.8 || (!typing() && now.h < baseline.h * 0.65)) {
                detectViolation('viewport_reduced');
            } else if (now.w >= baseline.w && now.h >= baseline.h) {
                baseline = now;
            }
        }, 900);
    });
    document.addEventListener('fullscreenchange', () => {
        if (!active) return;
        if (document.fullscreenElement) {
            fullscreenSeen = true;
            baseline = dimensions();
        } else if (fullscreenSeen) {
            detectViolation('fullscreen_exit');
        }
    });
    // Retry browser fullscreen on the next real user gesture if needed.
    document.addEventListener('click', () => {
        if (active && !locked && !telegram && !fullscreenSeen) requestFullScreen();
    }, true);
    document.addEventListener('contextmenu', event => {
        if (active && !typing()) event.preventDefault();
    });
    document.addEventListener('copy', event => {
        if (active && !typing()) event.preventDefault();
    });

    if (telegram) {
        telegram.onEvent("deactivated", () => {
            detectViolation("telegram_deactivated");
        });

        telegram.onEvent("activated", handleReturn);
        if (telegram.isVersionAtLeast?.('8.0')) {
            telegram.onEvent('fullscreenChanged', () => {
                if (!active) return;
                if (telegram.isFullscreen) {
                    telegramFullscreenSeen = true;
                    baseline = dimensions();
                } else if (telegramFullscreenSeen) {
                    detectViolation('telegram_fullscreen_exit');
                }
            });
        }
    }

    return {
        start(options = {}) {
            onViolation = options.onViolation || null;
            onReturn = options.onReturn || null;

            locked = Boolean(options.locked);
            active = true;
            clearTimers();
            baseline = dimensions();
            fullscreenSeen = Boolean(document.fullscreenElement);
            telegramFullscreenSeen = Boolean(telegram?.isFullscreen);
            if (!locked) requestFullScreen();

            try {
                telegram?.enableClosingConfirmation();
            } catch (error) {
                console.warn(error);
            }

            if (document.hidden) {
                detectViolation("page_hidden");
            }
        },

        lock() {
            locked = true;
        },

        unlock() {
            clearTimers();
            locked = false;
            baseline = dimensions();
            fullscreenSeen = Boolean(document.fullscreenElement);
            telegramFullscreenSeen = Boolean(telegram?.isFullscreen);
            if (active) requestFullScreen();

            if (active && document.hidden) {
                detectViolation("page_hidden");
            }
        },

        stop() {
            active = false;
            locked = false;
            clearTimers();
            baseline = null;
            fullscreenSeen = false;
            telegramFullscreenSeen = false;

            try {
                telegram?.disableClosingConfirmation();
            } catch (error) {
                console.warn(error);
            }
        },

        isLocked() {
            return locked;
        },

        isActive() {
            return active;
        }
    };
})();
