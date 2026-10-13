import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

/// Serves the bundled SimLoad web build (assets/web) to the WebView over
/// http://127.0.0.1, so ES modules and the simulation's Web Workers load the
/// same way they do on the website. Nothing leaves the device.
class LocalServer {
  LocalServer({AssetBundle? bundle, this.injectIntoIndex = ''}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;

  /// HTML placed at the start of index.html's `<head>`, before the app's scripts.
  final String injectIntoIndex;

  /// localStorage is per origin, port included, so the app keeps to one port
  /// (and the user's autosaved design) unless something else holds it.
  static const preferredPorts = [47615, 47616, 47617, 47618];

  HttpServer? _server;

  Uri get origin => Uri.parse('http://127.0.0.1:${_server!.port}/');

  Future<Uri> start() async {
    for (final port in [...preferredPorts, 0]) {
      try {
        _server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
        break;
      } on SocketException {
        continue;
      }
    }
    _server!.listen(_handle);
    return origin;
  }

  Future<void> stop() async => _server?.close(force: true);

  Future<void> _handle(HttpRequest req) async {
    final res = req.response;
    try {
      if (req.method != 'GET' && req.method != 'HEAD') {
        res.statusCode = HttpStatus.methodNotAllowed;
        return;
      }
      var path = Uri.decodeComponent(req.uri.path);
      if (path.contains('..')) {
        res.statusCode = HttpStatus.badRequest;
        return;
      }
      if (path == '/' || path.isEmpty) path = '/index.html';

      // The service worker would cache an old build across app updates; the
      // files are already on the device, so leave it out.
      final bytes = path == '/sw.js' ? null : await _load('assets/web$path');
      if (bytes == null) {
        res.statusCode = HttpStatus.notFound;
        return;
      }

      res.headers
        ..contentType = contentTypeFor(path)
        ..set(HttpHeaders.cacheControlHeader, 'no-cache')
        ..set('X-Content-Type-Options', 'nosniff');
      if (path == '/index.html') {
        res.add(utf8.encode(injectHead(utf8.decode(bytes), injectIntoIndex)));
      } else {
        res.add(bytes);
      }
    } catch (_) {
      res.statusCode = HttpStatus.internalServerError;
    } finally {
      await res.close();
    }
  }

  Future<Uint8List?> _load(String key) async {
    try {
      final data = await _bundle.load(key);
      return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    } catch (_) {
      return null;
    }
  }

  static String injectHead(String html, String snippet) {
    if (snippet.isEmpty) return html;
    final i = html.indexOf('<head>');
    if (i < 0) return snippet + html;
    return html.replaceRange(i + 6, i + 6, snippet);
  }

  static ContentType contentTypeFor(String path) {
    final ext = path.contains('.') ? path.substring(path.lastIndexOf('.') + 1).toLowerCase() : '';
    return switch (ext) {
      'html' => ContentType.html,
      'js' || 'mjs' => ContentType('text', 'javascript', charset: 'utf-8'),
      'css' => ContentType('text', 'css', charset: 'utf-8'),
      'json' => ContentType.json,
      'webmanifest' => ContentType('application', 'manifest+json', charset: 'utf-8'),
      'svg' => ContentType('image', 'svg+xml'),
      'png' => ContentType('image', 'png'),
      'jpg' || 'jpeg' => ContentType('image', 'jpeg'),
      'webp' => ContentType('image', 'webp'),
      'ico' => ContentType('image', 'x-icon'),
      'woff2' => ContentType('font', 'woff2'),
      'woff' => ContentType('font', 'woff'),
      'ttf' => ContentType('font', 'ttf'),
      'txt' || 'md' => ContentType.text,
      'wasm' => ContentType('application', 'wasm'),
      _ => ContentType.binary,
    };
  }
}
