// android/app/src/main/java/pl/luter/android16clean/MainActivity.java
package pl.luter.android16clean;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    private static final String[] CALCULATOR_PACKAGES = new String[]{
            "com.google.android.calculator",
            "com.android.calculator2",
            "com.sec.android.app.popupcalculator"
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        setupWebView();
        hideSystemUI();
        loadLauncher();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        int flags =
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        decorView.setSystemUiVisibility(flags);
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
    }

    private void loadLauncher() {
        // ładujemy index.html z assets/web
        String url = "file:///android_asset/web/index.html";
        webView.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        // jeśli jest historia w WebView – wracamy; w przeciwnym razie zachowanie domyślne
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    public class AndroidBridge {

        @JavascriptInterface
        public void openSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                showToast("Nie można otworzyć ustawień.");
            }
        }

        @JavascriptInterface
        public void openPhone() {
            try {
                Intent intent = new Intent(Intent.ACTION_DIAL);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                showToast("Nie znaleziono aplikacji telefonu.");
            }
        }

        @JavascriptInterface
        public void openCamera() {
            try {
                Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                showToast("Nie znaleziono aplikacji aparatu.");
            }
        }

        @JavascriptInterface
        public void openBrowser() {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com"));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                showToast("Nie znaleziono przeglądarki.");
            }
        }

        @JavascriptInterface
        public void openCalculator() {
            for (String pkg : CALCULATOR_PACKAGES) {
                try {
                    Intent launchIntent = getPackageManager().getLaunchIntentForPackage(pkg);
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(launchIntent);
                        return;
                    }
                } catch (Exception ignored) {
                }
            }
            showToast("Nie znaleziono aplikacji kalkulatora.");
        }

        private void showToast(final String message) {
            runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show()
            );
        }
    }
}
