package school.mirae.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/* MIRAÉ для Android: сайт школы в окне приложения. Ссылки сайта открываются внутри,
   внешние (Telegram, почта и т. п.) — в своих приложениях. Микрофон — для упражнений на произношение. */
public class MainActivity extends Activity {
  static final String HOME = "https://indigo-acad.github.io/mirae/";
  WebView web;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    if (android.os.Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{"android.permission.RECORD_AUDIO"}, 1);
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    web.setBackgroundColor(0xFF0B1535);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (u.toString().startsWith(HOME)) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest r) { r.grant(r.getResources()); }
    });
    setContentView(web);
    if (b != null) web.restoreState(b); else web.loadUrl(HOME);
  }
  @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
