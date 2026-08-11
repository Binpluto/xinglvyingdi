package starcamp.lifeadventure;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public final class MainActivity extends AppCompatActivity {
    private static final String START_URL = "https://starcamp-life-adventure.vercel.app/?source=android";
    private WebView webView;
    private SwipeRefreshLayout refreshLayout;
    private ProgressBar progress;
    private Button backButton;
    private Button forwardButton;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 43, 56));
        getWindow().setNavigationBarColor(Color.rgb(7, 43, 56));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(7, 43, 56));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));
        root.addView(progress);

        refreshLayout = new SwipeRefreshLayout(this);
        refreshLayout.setColorSchemeColors(Color.rgb(235, 195, 92), Color.rgb(49, 142, 139));
        webView = new WebView(this);
        refreshLayout.addView(webView, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(refreshLayout, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        root.addView(createNativeBar());
        setContentView(root);

        configureWebView();
        refreshLayout.setOnRefreshListener(webView::reload);
        String deepLink = getIntent().getDataString();
        webView.loadUrl(deepLink != null && deepLink.startsWith("https://starcamp-life-adventure.vercel.app") ? deepLink : START_URL);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                refreshLayout.setRefreshing(false);
                backButton.setEnabled(view.canGoBack());
                forwardButton.setEnabled(view.canGoForward());
                view.evaluateJavascript("window.__STARCAMP_NATIVE__='android';document.addEventListener('click',function(e){if(e.target.closest('.quest-check,.primary-round,.new-quest-button'))NativeStarcamp.haptic();},true);", null);
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
            }
        });
        webView.addJavascriptInterface(new NativeBridge(), "NativeStarcamp");
        android.webkit.CookieManager.getInstance().setAcceptCookie(true);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    }

    private View createNativeBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(10), dp(6), dp(10), dp(8));
        bar.setBackgroundColor(Color.rgb(10, 51, 64));
        backButton = nativeButton("‹\n后退", () -> { if (webView.canGoBack()) webView.goBack(); });
        forwardButton = nativeButton("›\n前进", () -> { if (webView.canGoForward()) webView.goForward(); });
        Button reload = nativeButton("↻\n刷新", () -> webView.reload());
        Button share = nativeButton("⇧\n分享", this::shareCurrentPage);
        backButton.setEnabled(false); forwardButton.setEnabled(false);
        bar.addView(backButton); bar.addView(forwardButton); bar.addView(reload); bar.addView(share);
        return bar;
    }

    private Button nativeButton(String text, Runnable action) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.rgb(239, 207, 123));
        button.setTextSize(11);
        button.setAllCaps(false);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setOnClickListener(view -> action.run());
        button.setLayoutParams(new LinearLayout.LayoutParams(0, dp(52), 1f));
        return button;
    }

    private void shareCurrentPage() {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_SUBJECT, "starcamp.lifeadventure");
        intent.putExtra(Intent.EXTRA_TEXT, "starcamp.lifeadventure\n" + webView.getUrl());
        startActivity(Intent.createChooser(intent, "分享星旅营地"));
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (webView != null) { webView.removeJavascriptInterface("NativeStarcamp"); webView.destroy(); }
        super.onDestroy();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    public final class NativeBridge {
        @JavascriptInterface public void haptic() {
            runOnUiThread(() -> {
                Vibrator vibrator = getSystemService(Vibrator.class);
                if (vibrator != null && vibrator.hasVibrator()) vibrator.vibrate(VibrationEffect.createOneShot(24, VibrationEffect.DEFAULT_AMPLITUDE));
            });
        }
    }
}
