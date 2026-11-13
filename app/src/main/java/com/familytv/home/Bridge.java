package com.familytv.home;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/** Methods the web UI can call as window.Android.*. Everything here is local to the TV. */
public class Bridge {

    static final String PREFS = "familytv";
    private static final Pattern TMDB_PATH =
            Pattern.compile("^(discover|trending|movie|tv|genre)/[A-Za-z0-9/_\\-]+(\\?[A-Za-z0-9_=&.%|:,\\-]*)?$");
    private static final Pattern PIN = Pattern.compile("^\\d{4}$");

    private final Activity act;
    private final WebView web;
    private final SharedPreferences prefs;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);
    private int pinFailures = 0;
    private long lockedUntil = 0;

    Bridge(Activity act, WebView web) {
        this.act = act;
        this.web = web;
        this.prefs = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------------ apps

    @JavascriptInterface
    public String getApps() {
        PackageManager pm = act.getPackageManager();
        JSONArray out = new JSONArray();
        Set<String> seen = new HashSet<>();
        String[] cats = {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER};
        for (String cat : cats) {
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(cat);
            List<ResolveInfo> list = pm.queryIntentActivities(i, 0);
            for (ResolveInfo ri : list) {
                String pkg = ri.activityInfo.packageName;
                if (pkg.equals(act.getPackageName()) || !seen.add(pkg)) continue;
                try {
                    JSONObject o = new JSONObject();
                    o.put("pkg", pkg);
                    o.put("label", String.valueOf(ri.loadLabel(pm)));
                    o.put("tv", Intent.CATEGORY_LEANBACK_LAUNCHER.equals(cat));
                    out.put(o);
                } catch (Exception ignored) { }
            }
        }
        return out.toString();
    }

    /** {"src":"data:image/png;base64,...","banner":true|false} or "" if the app is missing. */
    @JavascriptInterface
    public String getIcon(String pkg) {
        PackageManager pm = act.getPackageManager();
        try {
            Drawable d = null;
            boolean banner = false;
            Intent li = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (li != null) d = pm.getActivityBanner(li);
            if (d == null) d = pm.getApplicationBanner(pkg);
            if (d != null) banner = true; else d = pm.getApplicationIcon(pkg);
            Bitmap b = toBitmap(d, banner ? 400 : 192);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, bos);
            JSONObject o = new JSONObject();
            o.put("src", "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
            o.put("banner", banner);
            return o.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static Bitmap toBitmap(Drawable d, int maxW) {
        Bitmap src;
        if (d instanceof BitmapDrawable && ((BitmapDrawable) d).getBitmap() != null) {
            src = ((BitmapDrawable) d).getBitmap();
        } else {
            int w = d.getIntrinsicWidth() > 0 ? d.getIntrinsicWidth() : maxW;
            int h = d.getIntrinsicHeight() > 0 ? d.getIntrinsicHeight() : maxW;
            src = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(src);
            d.setBounds(0, 0, w, h);
            d.draw(c);
        }
        if (src.getWidth() <= maxW) return src;
        int h = Math.round(src.getHeight() * (maxW / (float) src.getWidth()));
        return Bitmap.createScaledBitmap(src, maxW, Math.max(1, h), true);
    }

    @JavascriptInterface
    public boolean launch(String pkg) {
        PackageManager pm = act.getPackageManager();
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return false;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        start(i);
        return true;
    }

    /** Opens an https link in a specific app (for example a YouTube video in the YouTube app). */
    @JavascriptInterface
    public boolean openUrl(String url, String pkg) {
        if (url == null || !url.startsWith("https://")) return false;
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        if (pkg != null && !pkg.isEmpty()) i.setPackage(pkg);
        if (i.resolveActivity(act.getPackageManager()) == null) return false;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        start(i);
        return true;
    }

    @JavascriptInterface
    public void openSettings() {
        Intent i = new Intent(Settings.ACTION_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        start(i);
    }

    private void start(final Intent i) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try { act.startActivity(i); } catch (Exception ignored) { }
            }
        });
    }

    @JavascriptInterface
    public String getVersion() {
        try {
            return act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    // ------------------------------------------------------------------ parents PIN

    @JavascriptInterface
    public boolean hasPin() {
        return prefs.contains("pin_hash");
    }

    @JavascriptInterface
    public boolean setPin(String pin) {
        if (pin == null || !PIN.matcher(pin).matches()) return false;
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        String s = Base64.encodeToString(salt, Base64.NO_WRAP);
        prefs.edit().putString("pin_salt", s).putString("pin_hash", hash(s, pin)).apply();
        return true;
    }

    /** "ok", "bad" or "locked:<seconds>". Five wrong tries lock entry for a minute. */
    @JavascriptInterface
    public String checkPin(String pin) {
        long now = SystemClock.elapsedRealtime();
        if (now < lockedUntil) return "locked:" + ((lockedUntil - now) / 1000 + 1);
        String salt = prefs.getString("pin_salt", null);
        String want = prefs.getString("pin_hash", null);
        if (salt == null || want == null || pin == null) return "bad";
        if (MessageDigest.isEqual(want.getBytes(StandardCharsets.UTF_8),
                hash(salt, pin).getBytes(StandardCharsets.UTF_8))) {
            pinFailures = 0;
            return "ok";
        }
        if (++pinFailures >= 5) {
            pinFailures = 0;
            lockedUntil = now + 60_000;
            return "locked:60";
        }
        return "bad";
    }

    private static String hash(String salt, String pin) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest((salt + ":" + pin).getBytes(StandardCharsets.UTF_8));
            for (int i = 0; i < 5000; i++) h = md.digest(h);
            return Base64.encodeToString(h, Base64.NO_WRAP);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ------------------------------------------------------------------ TMDB

    @JavascriptInterface
    public boolean hasTmdbKey() {
        return prefs.getString("tmdb_key", "").length() > 0;
    }

    /** Runs a TMDB API GET off the UI thread and answers app.tmdbDone(id, status, body). */
    @JavascriptInterface
    public void tmdb(final String path, final String id) {
        final String key = prefs.getString("tmdb_key", "");
        if (key.isEmpty() || path == null || !TMDB_PATH.matcher(path).matches()) {
            done(id, 0, "");
            return;
        }
        pool.submit(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection c = null;
                try {
                    String url = "https://api.themoviedb.org/3/" + path;
                    boolean bearer = key.startsWith("eyJ");
                    if (!bearer) url += (path.contains("?") ? "&" : "?") + "api_key=" + Uri.encode(key);
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(15000);
                    c.setRequestProperty("Accept", "application/json");
                    if (bearer) c.setRequestProperty("Authorization", "Bearer " + key);
                    int code = c.getResponseCode();
                    InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n;
                    while (in != null && (n = in.read(buf)) > 0) bos.write(buf, 0, n);
                    done(id, code, bos.toString("UTF-8"));
                } catch (Exception e) {
                    done(id, -1, "");
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        });
    }

    private void done(String id, int code, String body) {
        final String js = "window.app && app.tmdbDone(" + JSONObject.quote(id) + "," + code + ","
                + JSONObject.quote(body) + ")";
        web.post(new Runnable() {
            @Override
            public void run() { web.evaluateJavascript(js, null); }
        });
    }
}
