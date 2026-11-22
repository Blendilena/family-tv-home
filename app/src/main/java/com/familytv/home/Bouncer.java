package com.familytv.home;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

/**
 * Brings Family TV back on top as fast as Fire OS allows.
 *
 * After the Home button Android holds back app launches for about 5 seconds. A launch fired by
 * an alarm comes from the system itself and is not held back, so we use both: a direct start
 * (works instantly after Back or the screensaver) and an alarm-fired start (works after Home).
 * The PC toolkit sets alarm_manager_constants min_futurity=0 so the alarm fires immediately.
 * If Family TV still hasn't appeared, it retries at 1.5 s and 5.5 s.
 */
final class Bouncer {

    static final String TAG = HomeWatchService.TAG;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static long lastJump = 0;
    static volatile long lastResumed = 0;

    private Bouncer() { }

    static void launcherSeen(final Context ctx, String what) {
        final Context c = ctx.getApplicationContext();
        if (HomeWatchService.amazonHomeAllowed(c)) {
            Log.i(TAG, what + ": Amazon home allowed for now");
            return;
        }
        final long now = SystemClock.elapsedRealtime();
        if (now - lastJump < 1500) return;
        lastJump = now;
        Log.i(TAG, what + " -> bringing Family TV back");
        start(c, "direct");
        alarm(c);
        retryLater(c, now, 1500);
        retryLater(c, now, 5500);
    }

    private static void retryLater(final Context c, final long since, long delay) {
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (lastResumed >= since) return;                 // already back
                if (HomeWatchService.amazonHomeAllowed(c)) return;
                Log.i(TAG, "not back yet, retrying");
                start(c, "retry");
                alarm(c);
            }
        }, delay);
    }

    static Intent homeIntent(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return i;
    }

    static void start(Context c, String how) {
        try { c.startActivity(homeIntent(c)); }
        catch (Exception e) { Log.w(TAG, how + " start failed: " + e); }
    }

    private static void alarm(Context c) {
        try {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getActivity(c, 7, homeIntent(c), flags);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            long at = SystemClock.elapsedRealtime() + 20;
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            } else {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "alarm start failed: " + e);
        }
    }
}
