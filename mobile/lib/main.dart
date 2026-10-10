import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'bridge.dart';
import 'local_server.dart';

/// The web app's dark "mission control" background, so there's no white flash.
const background = Color(0xFF04070D);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: background,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const SimLoadApp());
}

class SimLoadApp extends StatelessWidget {
  const SimLoadApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SimLoad',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF22D3EE), brightness: Brightness.dark),
        scaffoldBackgroundColor: background,
      ),
      home: const SimulatorScreen(),
    );
  }
}

class SimulatorScreen extends StatefulWidget {
  const SimulatorScreen({super.key});

  @override
  State<SimulatorScreen> createState() => _SimulatorScreenState();
}

class _SimulatorScreenState extends State<SimulatorScreen> {
  final _server = LocalServer(injectIntoIndex: bridgeScript);
  WebViewController? _controller;
  var _loaded = false;
  String? _error;
  late final Bridge _bridge = Bridge(onToast: _toast, shareOrigin: _shareOrigin);

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  Future<void> _boot() async {
    try {
      try {
        await rootBundle.load('assets/web/index.html');
      } catch (_) {
        throw StateError('The web app is missing from this build. Run mobile/tool/build_web.sh, then build again.');
      }
      final origin = await _server.start();
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(background)
        ..addJavaScriptChannel(channelName, onMessageReceived: (m) => _bridge.handle(m.message))
        ..setNavigationDelegate(
          NavigationDelegate(
            onNavigationRequest: (req) => _route(req, origin),
            onPageFinished: (_) {
              if (mounted) setState(() => _loaded = true);
            },
            onWebResourceError: (e) {
              if (e.isForMainFrame == true && mounted) setState(() => _error = e.description);
            },
          ),
        );

      final platform = controller.platform;
      if (platform is AndroidWebViewController) {
        // Android's WebView needs the app to answer <input type="file"> (Import).
        await platform.setOnShowFileSelector(_pickFiles);
        await platform.setMediaPlaybackRequiresUserGesture(true);
      }
      await controller.loadRequest(origin);
      if (mounted) setState(() => _controller = controller);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  /// Keeps the app's own pages in the WebView and sends everything else to the browser.
  NavigationDecision _route(NavigationRequest req, Uri origin) {
    final uri = Uri.tryParse(req.url);
    if (uri == null) return NavigationDecision.prevent;
    if (uri.origin == origin.origin || uri.scheme == 'about' || uri.scheme == 'blob' || uri.scheme == 'data') {
      return NavigationDecision.navigate;
    }
    if (req.isMainFrame) unawaited(launchUrl(uri, mode: LaunchMode.externalApplication));
    return NavigationDecision.prevent;
  }

  Future<List<String>> _pickFiles(FileSelectorParams params) async {
    try {
      final files = await FilePicker.pickFiles(dialogTitle: 'Import a design');
      return files.map((f) => f.uri.toString()).toList();
    } catch (_) {
      return [];
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));
  }

  Rect _shareOrigin() {
    final size = MediaQuery.sizeOf(context);
    return Rect.fromCenter(center: Offset(size.width / 2, 80), width: 1, height: 1);
  }

  Future<void> _retry() async {
    setState(() {
      _error = null;
      _loaded = false;
    });
    await _controller?.reload();
  }

  @override
  void dispose() {
    unawaited(_server.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            if (controller != null) WebViewWidget(controller: controller),
            if (_error != null)
              _ErrorView(message: _error!, onRetry: _retry)
            else
              IgnorePointer(
                ignoring: _loaded,
                child: AnimatedOpacity(
                  opacity: _loaded ? 0 : 1,
                  duration: const Duration(milliseconds: 300),
                  child: const _Splash(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: background,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image(image: AssetImage('assets/icon/icon.png'), width: 96, height: 96),
            SizedBox(height: 20),
            Text(
              'SimLoad',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: .5),
            ),
            SizedBox(height: 6),
            Text('System design simulator', style: TextStyle(color: Color(0xFF94A3B8))),
            SizedBox(height: 28),
            SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFF87171)),
              const SizedBox(height: 16),
              const Text(
                "SimLoad couldn't start",
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: Colors.white),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 20),
              FilledButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ),
        ),
      ),
    );
  }
}
