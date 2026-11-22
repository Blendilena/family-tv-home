package com.familytv.home;

import android.graphics.Color;
import android.service.dreams.DreamService;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;

/** The Family TV screensaver: a cinematic slideshow for grown-ups, a playful sky for the kids. */
public class FamilyDream extends DreamService {

    private WebView web;
    private Bridge bridge;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);   // any button wakes the TV
        setFullscreen(true);
        setScreenBright(true);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);
        s.setAllowFileAccess(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        bridge = new Bridge(this, web);
        web.addJavascriptInterface(bridge, "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/screensaver.html");
    }

    @Override
    public void onDetachedFromWindow() {
        if (bridge != null) bridge.shutdown();
        if (web != null) { web.destroy(); web = null; }
        super.onDetachedFromWindow();
    }
}
