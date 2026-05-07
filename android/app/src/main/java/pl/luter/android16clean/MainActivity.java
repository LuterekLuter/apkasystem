package pl.luter.android16clean;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView webView;

    private static final String[] CALCULATOR_PACKAGES = {
            "com.google.android.calculator",
            "com.android.calculator2",
            "com.sec.android.app.popupcalculator",
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
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
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !url.startsWith("file://");
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // nie crashuj z powodu błędu zasobu
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
    }

    private void loadLauncher() {
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        }
    }

    public class AndroidBridge {

        @JavascriptInterface
        public void openSettings() {
            finishAffinity();
        }

        @JavascriptInterface
        public void openPhone() {
            safeStart(new Intent(Intent.ACTION_DIAL));
        }

        @JavascriptInterface
        public void openCamera() {
            safeStart(new Intent(MediaStore.ACTION_IMAGE_CAPTURE));
        }

        @JavascriptInterface
        public void openBrowser() {
            safeStart(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")));
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
            toast("Nie znaleziono kalkulatora.");
        }

        private void safeStart(Intent intent) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                toast("Nie znaleziono aplikacji.");
            } catch (Exception e) {
                toast("Błąd uruchamiania.");
            }
        }

        private void toast(final String msg) {
            runOnUiThread(() ->
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show()
            );
        }
    }
}
