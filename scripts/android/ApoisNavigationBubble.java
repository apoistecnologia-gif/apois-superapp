package br.com.apois.parceiro;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/**
 * APOIS QA239. Optional return bubble; no new Service and no accessibility service.
 * Only visible after an explicit permission + opt-in and a real Motorista operation.
 */
final class ApoisNavigationBubble {
    private static final String PREFS = "apois_navigation_bubble_qa239";
    private static WindowManager windowManager;
    private static View bubble;
    private static boolean motoristaActive = false;
    private static boolean callbacksRegistered = false;

    private ApoisNavigationBubble() {}

    static boolean enabled(Context context) {
        return context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean("enabled",false);
    }

    static boolean permitted(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(context);
    }

    static void setEnabled(Context context, boolean enabled) {
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("enabled",enabled).apply();
        if (!enabled) hide(context);
    }

    static synchronized void setMotoristaActive(Context context, boolean active) {
        motoristaActive=active;
        if (!active) hide(context);
    }

    static void showIfEnabled(Context context) {
        final Context app=context.getApplicationContext();
        if (!motoristaActive || !enabled(app) || !permitted(app)) return;
        new Handler(Looper.getMainLooper()).post(() -> attach(app));
    }

    private static int dp(Context c,int value) {
        return Math.round(value*c.getResources().getDisplayMetrics().density);
    }

    private static synchronized void attach(Context app) {
        if (bubble!=null || !motoristaActive || !enabled(app) || !permitted(app)) return;
        try {
            windowManager=(WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
            if (windowManager==null) return;
            TextView view=new TextView(app);
            view.setText("A");
            view.setTextColor(Color.WHITE);
            view.setTextSize(24);
            view.setGravity(Gravity.CENTER);
            view.setTypeface(android.graphics.Typeface.DEFAULT,android.graphics.Typeface.BOLD);
            view.setContentDescription("Voltar ao APOIS");
            GradientDrawable shape=new GradientDrawable();
            shape.setColor(Color.rgb(229,27,35));
            shape.setShape(GradientDrawable.OVAL);
            shape.setStroke(dp(app,2),Color.WHITE);
            view.setBackground(shape);
            view.setElevation(dp(app,7));
            view.setOnClickListener(v -> {
                hide(app);
                try {
                    Intent launch=new Intent(app,MainActivity.class);
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    app.startActivity(launch);
                } catch (RuntimeException ignored) {
                    // Persistent notification remains the supported return fallback.
                }
            });
            WindowManager.LayoutParams params=new WindowManager.LayoutParams(
                dp(app,54), dp(app,54), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
            params.gravity=Gravity.RIGHT|Gravity.CENTER_VERTICAL;
            params.x=dp(app,12);
            params.y=dp(app,-48);
            windowManager.addView(view,params);
            bubble=view;
            registerResumeCleanup(app);
        } catch (RuntimeException error) {
            bubble=null;
        }
    }

    private static void registerResumeCleanup(Context app) {
        if (callbacksRegistered || !(app instanceof Application)) return;
        ((Application)app).registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            @Override public void onActivityResumed(Activity activity) {
                if (activity instanceof MainActivity) hide(app);
            }
            @Override public void onActivityCreated(Activity activity, Bundle state) {}
            @Override public void onActivityStarted(Activity activity) {}
            @Override public void onActivityPaused(Activity activity) {}
            @Override public void onActivityStopped(Activity activity) {}
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
            @Override public void onActivityDestroyed(Activity activity) {}
        });
        callbacksRegistered=true;
    }

    static void hide(Context context) {
        new Handler(Looper.getMainLooper()).post(() -> {
            synchronized (ApoisNavigationBubble.class) {
                if (bubble==null) return;
                try { if (windowManager!=null) windowManager.removeView(bubble); }
                catch (RuntimeException ignored) {}
                bubble=null;
            }
        });
    }
}
