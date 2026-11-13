package com.familytv.home;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Invisible settings receiver, startable only from adb (protected by the DUMP permission):
 *   am start -n com.familytv.home/.ConfigActivity --es tmdb_key KEY
 *   am start -n com.familytv.home/.ConfigActivity --ez reset_pin true
 *   am start -n com.familytv.home/.ConfigActivity --es kids 'Name1,Name2'
 */
public class ConfigActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent in = getIntent();
        SharedPreferences.Editor e = getSharedPreferences(Bridge.PREFS, Context.MODE_PRIVATE).edit();
        StringBuilder msg = new StringBuilder();
        String key = in.getStringExtra("tmdb_key");
        if (key != null && key.trim().length() > 0) {
            e.putString("tmdb_key", key.trim());
            msg.append("TMDB key saved. ");
        }
        String kids = in.getStringExtra("kids");
        if (kids != null) {
            e.putString("kids_names", kids.trim());
            msg.append(kids.trim().isEmpty() ? "Kids' names cleared. " : "Kids' names saved. ");
        }
        if (in.getBooleanExtra("reset_pin", false)) {
            e.remove("pin_hash").remove("pin_salt");
            msg.append("Parents PIN cleared: set a new one next time. ");
        }
        e.apply();
        if (msg.length() > 0) Toast.makeText(this, msg.toString().trim(), Toast.LENGTH_LONG).show();
        startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }
}
