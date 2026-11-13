package com.familytv.home;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

/**
 * Keeps a small listener alive so Family TV ("Who's watching?") comes back every time the TV
 * wakes up, not only after a full restart. Screen-on events can only be heard by a running
 * component, so this runs as a quiet foreground service.
 */
public class WakeService extends Service {

    private static final String CHANNEL = "familytv_wake";
    private final Handler handler = new Handler(Looper.getMainLooper());

    /** Kept up to date by MainActivity so we know whether Family TV was on screen. */
    static volatile boolean inFront = false;
    static volatile long lastPausedAt = 0;
    private boolean dreamFromHome = false;

    private final BroadcastReceiver screenOn = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String a = intent.getAction();
            if (Intent.ACTION_DREAMING_STARTED.equals(a)) {
                // Screensaver starting: remember whether it covered Family TV.
                dreamFromHome = inFront || SystemClock.elapsedRealtime() - lastPausedAt < 4000;
                return;
            }
            long delay;
            if (Intent.ACTION_SCREEN_ON.equals(a)) {
                delay = 1500;            // TV woke up: always come back to Who's watching?
            } else if (Intent.ACTION_DREAMING_STOPPED.equals(a)) {
                if (!dreamFromHome) return;   // screensaver was over another app (e.g. Netflix): leave it
                delay = 700;             // screensaver ended over Family TV: make sure we're back on top
            } else {
                return;
            }
            handler.removeCallbacksAndMessages(null);
            handler.postDelayed(new Runnable() {
                @Override
                public void run() { openHome(WakeService.this); }
            }, delay);
        }
    };

    static void start(Context c) {
        Intent i = new Intent(c, WakeService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignored) { }
    }

    static void openHome(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try { c.startActivity(i); } catch (Exception ignored) { }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Family TV", NotificationManager.IMPORTANCE_MIN));
            b = new Notification.Builder(this, CHANNEL);
        } else {
            b = new Notification.Builder(this);
        }
        Notification n = b.setSmallIcon(R.drawable.icon)
                .setContentTitle("Family TV")
                .setContentText("Opens Who's watching? when the TV wakes")
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, n);
        IntentFilter f = new IntentFilter(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_DREAMING_STARTED);
        f.addAction(Intent.ACTION_DREAMING_STOPPED);
        registerReceiver(screenOn, f);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        try { unregisterReceiver(screenOn); } catch (Exception ignored) { }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
