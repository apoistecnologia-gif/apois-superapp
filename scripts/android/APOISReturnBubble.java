package br.com.apois.parceiro;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.FrameLayout;

/**
 * APOIS_PARCEIRO_QA240_BRANDED_RETURN_BUBBLE_V1
 * Official APOIS logo, never a synthetic letter. The bubble exists only during
 * external navigation for a live driver ride, with OS-granted overlay permission.
 * No new service, polling, location provider, Maps API or financial operation.
 */
public final class APOISReturnBubble {
    private static final String PREFS = "apois_qa239_overlay"; // Keep QA239 persisted ride state.
    private static WindowManager manager;
    private static View bubble;
    private static boolean externalNavigatorVisible = false;

    private APOISReturnBubble() {}

    public static boolean granted(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(context);
    }

    public static void active(Context context, boolean active) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("rideActive", active).apply();
        if (!active) {
            externalNavigatorVisible = false;
            hide();
        }
    }

    public static void externalNavigationLaunched() {
        externalNavigatorVisible = true;
    }

    public static void externalNavigationClosed() {
        externalNavigatorVisible = false;
        hide();
    }

    public static synchronized void hide() {
        if (manager != null && bubble != null) {
            try { manager.removeViewImmediate(bubble); } catch (Exception ignored) {}
        }
        bubble = null;
        manager = null;
    }

    public static synchronized void show(Context context) {
        if (bubble != null || !externalNavigatorVisible || !granted(context)
            || !context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                  .getBoolean("rideActive", false)) return;

        final Context app = context.getApplicationContext();
        try {
            WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return;

            FrameLayout container = new FrameLayout(app);
            container.setContentDescription("Voltar para a corrida no APOIS");
            container.setClickable(true);
            container.setFocusable(false);
            container.setElevation(dp(app, 7));

            GradientDrawable rim = new GradientDrawable();
            rim.setShape(GradientDrawable.OVAL);
            rim.setColor(Color.WHITE);
            rim.setStroke(dp(app, 2), Color.rgb(220, 23, 35));
            container.setBackground(rim);

            ImageView brand = new ImageView(app);
            brand.setImageResource(R.drawable.apois_return_logo);
            brand.setContentDescription("APOIS Parceiro");
            brand.setScaleType(ImageView.ScaleType.FIT_CENTER);
            FrameLayout.LayoutParams imageParams = new FrameLayout.LayoutParams(
                dp(app, 56), dp(app, 56), Gravity.CENTER);
            imageParams.setMargins(dp(app, 2), dp(app, 2), dp(app, 2), dp(app, 2));
            container.addView(brand, imageParams);

            // Do NOT remove the visible overlay before startActivity(): some Android
            // versions restrict background Activity launches without a visible overlay.
            container.setOnClickListener(view -> {
                try {
                    Intent back = new Intent(app, MainActivity.class);
                    back.setAction(Intent.ACTION_VIEW);
                    back.setData(Uri.parse("br.com.apois.parceiro://module/motorista"));
                    back.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    app.startActivity(back); // Actual user click, never auto-hijack Google Maps.
                    // MainActivity.onResume() closes the bubble after focus is restored.
                } catch (Exception ignored) {
                    // Retain the bubble and the QA236 persistent-notification fallback.
                }
            });

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                dp(app, 60), dp(app, 60),
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
            params.x = dp(app, 10);
            params.y = dp(app, 56);
            wm.addView(container, params);
            manager = wm;
            bubble = container;
        } catch (Exception failure) {
            hide();
        }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
