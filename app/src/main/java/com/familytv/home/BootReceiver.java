package com.familytv.home;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Opens Family TV ("Who's watching?") when the Fire TV starts up. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        WakeService.start(context);
        WakeService.openHome(context);
    }
}
