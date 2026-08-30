import SwiftUI
import UIKit
import WebKit

private let starcampURL = URL(string: "https://starcamp-life-adventure.vercel.app/?source=ios")!

@MainActor
final class StarcampBrowserModel: ObservableObject {
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var isLoading = true
    weak var webView: WKWebView?

    func back() { webView?.goBack() }
    func forward() { webView?.goForward() }
    func reload() { webView?.reload() }
}

struct ContentView: View {
    @StateObject private var model = StarcampBrowserModel()
    @State private var shareItems: [Any] = []
    @State private var showingShare = false

    var body: some View {
        WebContainer(model: model)
            .ignoresSafeArea(.container, edges: .bottom)
            .overlay(alignment: .top) {
                if model.isLoading {
                    ProgressView().tint(Color(red: 0.95, green: 0.79, blue: 0.37)).padding(.top, 8)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                HStack(spacing: 4) {
                    NativeBarButton(symbol: "chevron.left", label: "后退", enabled: model.canGoBack, action: model.back)
                    NativeBarButton(symbol: "chevron.right", label: "前进", enabled: model.canGoForward, action: model.forward)
                    NativeBarButton(symbol: "arrow.clockwise", label: "刷新", action: model.reload)
                    NativeBarButton(symbol: "square.and.arrow.up", label: "分享") {
                        shareItems = ["starcamp.lifeadventure", model.webView?.url ?? starcampURL]
                        showingShare = true
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial)
                .overlay(alignment: .top) { Divider().opacity(0.3) }
            }
            .sheet(isPresented: $showingShare) { ActivityView(items: shareItems) }
    }
}

private struct NativeBarButton: View {
    let symbol: String
    let label: String
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: symbol).font(.system(size: 17, weight: .semibold))
                Text(label).font(.system(size: 9, weight: .medium))
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(enabled ? Color(red: 0.94, green: 0.81, blue: 0.47) : .secondary)
        }
        .disabled(!enabled)
        .accessibilityLabel(label)
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

private struct WebContainer: UIViewRepresentable {
    @ObservedObject var model: StarcampBrowserModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "starcampNative")
        controller.addUserScript(WKUserScript(source: """
            window.__STARCAMP_NATIVE__ = 'ios';
            document.addEventListener('click', function(event) {
              if (event.target.closest('.quest-check, .primary-round, .new-quest-button')) {
                window.webkit.messageHandlers.starcampNative.postMessage('haptic');
              }
            }, true);
        """, injectionTime: .atDocumentStart, forMainFrameOnly: false))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        model.webView = webView
        webView.load(URLRequest(url: starcampURL, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let model: StarcampBrowserModel
        init(model: StarcampBrowserModel) { self.model = model }

        @objc func refresh(_ sender: UIRefreshControl) { model.webView?.reload() }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.isLoading = false
            model.canGoBack = webView.canGoBack
            model.canGoForward = webView.canGoForward
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            model.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if let scheme = url.scheme?.lowercased(), !["http", "https"].contains(scheme) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "starcampNative", message.body as? String == "haptic" {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        }
    }
}
