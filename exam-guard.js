
/* ExamPrep Studio — Exam Guard */

window.ExamGuard = (() => {
    let active = false;
    let locked = false;
    let onViolation = null;
    let onReturn = null;

    const telegram = window.Telegram?.WebApp;

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

    if (telegram) {
        telegram.onEvent("deactivated", () => {
            detectViolation("telegram_deactivated");
        });

        telegram.onEvent("activated", handleReturn);
    }

    return {
        start(options = {}) {
            onViolation = options.onViolation || null;
            onReturn = options.onReturn || null;

            locked = Boolean(options.locked);
            active = true;

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
            locked = false;

            if (active && document.hidden) {
                detectViolation("page_hidden");
            }
        },

        stop() {
            active = false;
            locked = false;

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
