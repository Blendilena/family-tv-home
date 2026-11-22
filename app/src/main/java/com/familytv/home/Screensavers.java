package com.familytv.home;

import android.content.ContentResolver;
import android.content.Context;
import android.provider.Settings;
import android.util.Log;

/** The screensavers Family TV can switch between (Settings.Secure, needs WRITE_SECURE_SETTINGS). */
final class Screensavers {
    static final String FAMILY = "com.familytv.home/.FamilyDream";
    static final String AERIAL = "com.neilturner.aerialviews/.ui.screensaver.DreamActivity";
    static final String AMAZON = "com.amazon.bueller.photos/.daydream.ScreenSaverService";

    private Screensavers() { }

    static String nameOf(String c) {
        if (c == null) return "amazon";
        if (c.contains("com.familytv.home")) return "family";
        if (c.contains("aerialviews")) return "aerial";
        if (c.contains("bueller")) return "amazon";
        return c;
    }

    static boolean set(Context ctx, String which) {
        String comp = "family".equals(which) ? FAMILY : "aerial".equals(which) ? AERIAL : "amazon".equals(which) ? AMAZON : null;
        if (comp == null) return false;
        try {
            ContentResolver cr = ctx.getContentResolver();
            Settings.Secure.putString(cr, "screensaver_components", comp);
            Settings.Secure.putString(cr, "screensaver_default_component", comp);
            Settings.Secure.putInt(cr, "screensaver_enabled", 1);
            return true;
        } catch (Exception e) {
            Log.w(HomeWatchService.TAG, "screensaver switch not allowed: " + e);
            return false;
        }
    }
}
