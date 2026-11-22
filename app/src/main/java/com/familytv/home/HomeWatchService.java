package com.familytv.home;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * Fire OS doesn't let apps replace Amazon's home screen, so Home (and Back out of an app)
 * always lands there. This service is told only when Amazon's home screen comes to the front
 * (it is limited to that one package and never reads screen content), and puts Family TV
 * straight back on top.
 *
 * Turned on and off from the PC: firetv.ps1 homeapp-watch on|off.
 */
public class HomeWatchService extends AccessibilityService {

    static final String TAG = "FamilyTVHome";
    static final String LAUNCHER = "com.amazon.tv.launcher";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private long lastJump = 0;

    @Override
    protected void onServiceConnected() {
        Log.i(TAG, "home watch connected");
        WakeService.start(this);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e == null || e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        CharSequence pkg = e.getPackageName();
        if (pkg == null || !LAUNCHER.contentEquals(pkg)) return;
        String cls = e.getClassName() == null ? "" : e.getClassName().toString();
        if (amazonHomeAllowed(this)) {
            Log.i(TAG, "launcher " + cls + " allowed (parents chose Amazon home)");
            return;
        }
        // Only full screens: leave pop-ups and overlays (dialogs, menus) alone.
        boolean screen = cls.endsWith("Activity") || cls.contains("Activity_") || cls.contains(".activity.") || cls.contains("Home");
        if (!screen || cls.startsWith("android.")) {
            Log.i(TAG, "launcher " + cls + " ignored");
            return;
        }
        long now = SystemClock.elapsedRealtime();
        if (now - lastJump < 900) return;
        lastJump = now;
        Log.i(TAG, "launcher " + cls + " -> Family TV");
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(new Runnable() {
            @Override
            public void run() { WakeService.openHome(HomeWatchService.this); }
        }, 60);
    }

    @Override
    public void onInterrupt() { }

    static boolean amazonHomeAllowed(Context c) {
        SharedPreferences p = c.getSharedPreferences(Bridge.PREFS, Context.MODE_PRIVATE);
        return System.currentTimeMillis() < p.getLong("amazon_home_until", 0);
    }

    /** Lets Amazon's home stay on screen for a while (Parents > Apps > Amazon home). */
    static void allowAmazonHome(Context c, long minutes) {
        c.getSharedPreferences(Bridge.PREFS, Context.MODE_PRIVATE).edit()
                .putLong("amazon_home_until", System.currentTimeMillis() + minutes * 60_000L).apply();
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        i.setPackage(LAUNCHER);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { c.startActivity(i); } catch (Exception ignored) { }
    }

    static void clearAmazonHomeAllowance(Context c) {
        c.getSharedPreferences(Bridge.PREFS, Context.MODE_PRIVATE).edit().remove("amazon_home_until").apply();
    }
}
