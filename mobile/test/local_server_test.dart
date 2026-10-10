import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:simload/bridge.dart';
import 'package:simload/local_server.dart';

/// Serves a few in-memory files as if they were bundled assets.
class FakeBundle extends CachingAssetBundle {
  FakeBundle(this.files);
  final Map<String, String> files;

  @override
  Future<ByteData> load(String key) async {
    final f = files[key];
    if (f == null) throw StateError('missing $key');
    return ByteData.sublistView(Uint8List.fromList(utf8.encode(f)));
  }
}

void main() {
  late LocalServer server;
  late Uri origin;
  final client = HttpClient();

  setUp(() async {
    server = LocalServer(
      bundle: FakeBundle({
        'assets/web/index.html': '<!doctype html><html><head><title>SimLoad · ü</title></head><body></body></html>',
        'assets/web/assets/app.js': 'console.log(1)',
        'assets/web/sw.js': 'self.x = 1',
      }),
      injectIntoIndex: '<script>window.injected = true</script>',
    );
    origin = await server.start();
  });

  tearDown(() => server.stop());

  Future<(int, String, String?)> get(String path) async {
    final req = await client.getUrl(origin.resolve(path));
    final res = await req.close();
    return (res.statusCode, await res.transform(utf8.decoder).join(), res.headers.contentType?.mimeType);
  }

  test('listens on loopback only, on a fixed port', () {
    expect(origin.host, '127.0.0.1');
    expect(LocalServer.preferredPorts, contains(origin.port));
  });

  test('serves index.html at / with the bridge first in <head>', () async {
    final (status, body, type) = await get('/');
    expect(status, 200);
    expect(type, 'text/html');
    expect(body, startsWith('<!doctype html><html><head><script>window.injected = true</script><title>SimLoad · ü'));
  });

  test('serves assets with their content type', () async {
    final (status, body, type) = await get('/assets/app.js');
    expect(status, 200);
    expect(type, 'text/javascript');
    expect(body, 'console.log(1)');
  });

  test('leaves out the service worker, missing files and path tricks', () async {
    expect((await get('/sw.js')).$1, 404);
    expect((await get('/nope.js')).$1, 404);
    expect((await get('/assets/%2e%2e/%2e%2e/pubspec.yaml')).$1, anyOf(400, 404));
  });

  test('a second server falls back to another port', () async {
    final other = LocalServer(bundle: FakeBundle({}));
    final o = await other.start();
    expect(o.port, isNot(origin.port));
    await other.stop();
  });

  test('download names stay one safe path segment', () {
    expect(safeFileName('url-shortener.simload.json'), 'url-shortener.simload.json');
    expect(safeFileName('../../etc/passwd'), '..-..-etc-passwd');
    expect(safeFileName('..'), 'download');
    expect(safeFileName(''), 'download');
  });

  test('the bridge script points at the right channel and site', () {
    expect(bridgeScript, contains('window.$channelName.postMessage'));
    expect(bridgeScript, contains("join('$publicSite')"));
    expect(bridgeScript, isNot(contains(r'$')));
  });
}
