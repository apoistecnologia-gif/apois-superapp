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
import android.widget.TextView;

/** QA239: optional return shortcut. No background start, no new GPS service. */
public final class APOISReturnBubble {
  private static final String PREFS="apois_qa239_overlay";
  private static WindowManager manager;
  private static View view;
  private APOISReturnBubble(){}
  public static boolean granted(Context c){return Build.VERSION.SDK_INT>=23 && Settings.canDrawOverlays(c);}
  public static boolean enabled(Context c){return c.getSharedPreferences(PREFS,0).getBoolean("enabled",false);}
  public static void configure(Context c,boolean enabled){
    c.getSharedPreferences(PREFS,0).edit().putBoolean("enabled",enabled).apply();
    if(!enabled)hide();
  }
  public static void active(Context c,boolean active){
    c.getSharedPreferences(PREFS,0).edit().putBoolean("rideActive",active).apply();
    if(!active)hide();
  }
  public static synchronized void hide(){
    if(manager!=null&&view!=null)try{manager.removeViewImmediate(view);}catch(Exception ignored){}
    manager=null;view=null;
  }
  public static synchronized void show(Context context){
    if(view!=null||!enabled(context)||!granted(context)
      ||!context.getSharedPreferences(PREFS,0).getBoolean("rideActive",false))return;
    Context c=context.getApplicationContext();
    try{
      WindowManager wm=(WindowManager)c.getSystemService(Context.WINDOW_SERVICE);
      if(wm==null)return;
      TextView bubble=new TextView(c);
      bubble.setText("A");bubble.setTextColor(Color.WHITE);bubble.setTextSize(23f);
      bubble.setGravity(Gravity.CENTER);
      bubble.setContentDescription("Voltar ao APOIS Parceiro");
      GradientDrawable background=new GradientDrawable();
      background.setShape(GradientDrawable.OVAL);
      background.setColor(Color.rgb(220,23,35));
      background.setStroke(dp(c,2),Color.WHITE);
      bubble.setBackground(background);bubble.setElevation(dp(c,6));
      bubble.setOnClickListener(clicked->{
        hide();
        try{
          Intent back=new Intent(Intent.ACTION_VIEW,Uri.parse("br.com.apois.parceiro://module/motorista"));
          back.setPackage(c.getPackageName());
          back.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
          c.startActivity(back); // User-initiated tap, not an automatic foreground hijack.
        }catch(Exception ignored){} // QA236 notification remains available.
      });
      WindowManager.LayoutParams lp=new WindowManager.LayoutParams(dp(c,54),dp(c,54),
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT);
      lp.gravity=Gravity.END|Gravity.CENTER_VERTICAL;lp.x=dp(c,10);lp.y=dp(c,80);
      wm.addView(bubble,lp);
      manager=wm;view=bubble;
    }catch(Exception failure){hide();}
  }
  private static int dp(Context c,int n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
}
