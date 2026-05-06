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
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    private static final String[] CALCULATOR_PACKAGES = {
            "com.google.android.calculator",
            "com.android.calculator2",
            "com.sec.android.app.popupcalculator",
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        // Ukryj ActionBar i pasek tytułu PRZED super i setContentView
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        super.onCreate(savedInstanceState);

        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }

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
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
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
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false); // wyłącz — blokuje file:// na niektórych ROM-ach
        }

        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Blokuj nawigację poza file:// — zapobiega crashowi WebView
                String url = request.getUrl().toString();
                if (url.startsWith("file://")) {
                    return false; // pozwól WebView obsłużyć
                }
                // Wszystko inne (http, https, tel, intent...) — ignoruj
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                // Nie rób nic — nie crashuj apki z powodu błędu zasobu
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
    }

    private void loadLauncher() {
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    @Override
    public void onBackPressed() {
        // Launcher — przycisk wstecz nigdy nie zamyka apki
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        }
        // Celowo NIE wywołujemy super.onBackPressed()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AndroidBridge
    // ─────────────────────────────────────────────────────────────────────────

    public class AndroidBridge {

        @JavascriptInterface
        public void openSettings() {
            safeStartActivity(new Intent(Settings.ACTION_SETTINGS));
        }

        @JavascriptInterface
        public void openPhone() {
            safeStartActivity(new Intent(Intent.ACTION_DIAL));
        }

        @JavascriptInterface
        public void openCamera() {
            safeStartActivity(new Intent(MediaStore.ACTION_IMAGE_CAPTURE));
        }

        @JavascriptInterface
        public void openBrowser() {
            safeStartActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")));
        }

        @JavascriptInterface
        public void openCalculator() {
            for (String pkg : CALCULATOR_PACKAGES) {
                try {
                    Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
                    if (i != null) {
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                        return;
                    }
                } catch (Exception ignored) {}
            }
            showToast("Nie znaleziono aplikacji kalkulatora.");
        }

        private void safeStartActivity(Intent intent) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                showToast("Nie znaleziono aplikacji.");
            } catch (Exception e) {
                showToast("Nie można uruchomić aplikacji.");
            }
        }

        private void showToast(final String msg) {
            runOnUiThread(() ->
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show()
            );
        }
    }
}
