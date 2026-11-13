package com.familytv.home;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Full-screen WebView that shows the Family TV home (assets/www) and bridges to Android. */
public class MainActivity extends Activity {

    /** After this long away (or after the screen turned off) the app goes back to "Who's watching?". */
    private static final long RELOCK_AFTER_MS = 20 * 60 * 1000L;

    private WebView web;
    private long pausedAt = 0;
    private boolean screenWasOff = false;

    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) screenWasOff = true;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0E1116"));
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // The UI never navigates away from its own files.
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });

        web.addJavascriptInterface(new Bridge(this, web), "Android");
        setContentView(web);
        web.setFocusable(true);
        web.requestFocus();

        registerReceiver(screenReceiver, new IntentFilter(Intent.ACTION_SCREEN_OFF));
        WakeService.start(this);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = SystemClock.elapsedRealtime();
    }

    @Override
    protected void onResume() {
        super.onResume();
        boolean relock = screenWasOff
                || (pausedAt > 0 && SystemClock.elapsedRealtime() - pausedAt > RELOCK_AFTER_MS);
        screenWasOff = false;
        js("window.app && app.onWake(" + relock + ")");
    }

    @Override
    public void onBackPressed() {
        // Back is handled inside the UI; the home app never closes itself.
        js("window.app && app.back()");
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(screenReceiver); } catch (Exception ignored) { }
        if (web != null) web.destroy();
        super.onDestroy();
    }

    void js(final String code) {
        if (web == null) return;
        web.post(new Runnable() {
            @Override
            public void run() { web.evaluateJavascript(code, null); }
        });
    }
}
