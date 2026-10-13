import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// The public site: share links point here so they open for anyone.
const publicSite = 'https://simload.webappslab.com/';

/// Name of the JavaScript channel the page posts to.
const channelName = 'SimLoadApp';

/// Runs in the page before the app's own scripts. A WebView has no download
/// manager, pop-up windows or (reliable) clipboard, so this hands those jobs
/// to the native side as JSON messages.
const bridgeScript =
    '''
<script>
(function () {
  var post = function (msg) { try { window.$channelName.postMessage(JSON.stringify(msg)); } catch (e) {} };

  // Downloads (Export JSON, Markdown report): a click on <a download href="blob:...">.
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && /^(blob|data):/.test(this.href)) {
      var name = this.getAttribute('download') || 'download';
      fetch(this.href).then(function (r) { return r.blob(); }).then(function (blob) {
        var reader = new FileReader();
        reader.onload = function () {
          var url = String(reader.result);
          post({ type: 'download', name: name, mime: blob.type, base64: url.slice(url.indexOf(',') + 1) });
        };
        reader.readAsDataURL(blob);
      });
      return;
    }
    return click.apply(this, arguments);
  };

  // The printable report opens an empty window, writes HTML into it and calls print().
  var open = window.open;
  window.open = function (url, target, features) {
    if (!url || url === 'about:blank') {
      var html = '', sent = false;
      var send = function () { if (!sent) { sent = true; post({ type: 'print', html: html }); } };
      return {
        document: { write: function (s) { html += s; }, writeln: function (s) { html += s + '\\n'; }, open: function () {}, close: function () {} },
        addEventListener: function (type, fn) { if (type === 'load') setTimeout(fn, 0); },
        print: send, focus: function () {}, close: function () {},
      };
    }
    var abs = new URL(url, location.href);
    if (abs.origin !== location.origin) { post({ type: 'open', url: abs.href }); return null; }
    return open.apply(window, arguments);
  };

  // Clipboard: share links use this page's origin, so swap in the public site.
  var copy = function (text) {
    text = String(text).split(location.origin + '/').join('$publicSite');
    post({ type: 'copy', text: text });
    return Promise.resolve();
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText = copy;
    navigator.clipboard.write = function (items) {
      var item = items && items[0];
      if (!item) return Promise.resolve();
      return item.getType('text/plain').then(function (b) { return b.text(); }).then(copy);
    };
  }

  // The files are already on the device; a service worker would only keep an
  // old build cached across app updates.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = function () { return Promise.reject(new Error('Not used in the app')); };
  }

  // Everything is on the device, so the "Offline" badge only confuses.
  var style = document.createElement('style');
  style.textContent = '.offline-badge { display: none !important; }';
  document.head.appendChild(style);
})();
</script>
''';

/// Handles the bridge's messages on the native side.
class Bridge {
  Bridge({required this.onToast, required this.shareOrigin});

  final void Function(String message) onToast;

  /// Where share sheets anchor on iPad.
  final Rect Function() shareOrigin;

  Future<void> handle(String raw) async {
    final Map<String, dynamic> msg;
    try {
      msg = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    try {
      switch (msg['type']) {
        case 'download':
          await _saveAndShare(
            safeFileName(msg['name'] as String? ?? 'download'),
            base64Decode(msg['base64'] as String? ?? ''),
            msg['mime'] as String?,
          );
        case 'print':
          await _printReport(msg['html'] as String? ?? '');
        case 'copy':
          await Clipboard.setData(ClipboardData(text: msg['text'] as String? ?? ''));
          // Android 13+ shows its own "Copied" confirmation.
          if (!Platform.isAndroid) onToast('Copied to the clipboard');
        case 'open':
          final uri = Uri.tryParse(msg['url'] as String? ?? '');
          if (uri != null && (uri.scheme == 'https' || uri.scheme == 'http' || uri.scheme == 'mailto')) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
      }
    } catch (e) {
      debugPrint('SimLoad bridge: $e');
      onToast("Sorry, that didn't work on this device");
    }
  }

  /// Opens the system print dialog (with Save as PDF). If this device can't
  /// turn HTML into a PDF, shares the report as a web page instead.
  Future<void> _printReport(String html) async {
    try {
      await Printing.layoutPdf(
        name: 'SimLoad report',
        // ignore: deprecated_member_use
        onLayout: (format) => Printing.convertHtml(format: format, html: html),
      );
    } catch (_) {
      await _saveAndShare('simload-report.html', Uint8List.fromList(utf8.encode(html)), 'text/html');
    }
  }

  Future<void> _saveAndShare(String name, Uint8List bytes, String? mime) async {
    final dir = Directory('${(await getTemporaryDirectory()).path}/exports');
    await dir.create(recursive: true);
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(bytes);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: mime?.isNotEmpty == true ? mime : null, name: name)],
        sharePositionOrigin: shareOrigin(),
      ),
    );
  }
}

/// Keeps a file name from the page to one safe path segment.
@visibleForTesting
String safeFileName(String name) {
  final cleaned = name.replaceAll(RegExp(r'[/\\:*?"<>|\x00-\x1f]'), '-').trim();
  return cleaned.isEmpty || cleaned == '.' || cleaned == '..' ? 'download' : cleaned;
}
