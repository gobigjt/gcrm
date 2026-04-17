import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../config/web_app_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Avoid hanging forever on cold start / splash when the host is wrong or offline.
  static const Duration requestTimeout = Duration(seconds: 20);

  // Centralized app API URL from WebAppConfig (override with --dart-define=API_BASE_URL=...).
  static String get baseUrl => WebAppConfig.apiBaseUrl;

  /// Ensures [raw] becomes an absolute http(s) URL. On Flutter Web, a host without a scheme
  /// is treated as a path on the app origin (e.g. localhost:port/127.0.0.1:4000/...).
  static String normalizeApiBase(String raw) {
    var s = raw.trim();
    if (s.isEmpty) {
      return WebAppConfig.apiBaseUrl;
    }
    while (s.endsWith('/')) {
      s = s.substring(0, s.length - 1);
    }
    // Common typo: --dart-define=API_BASE_URL=http:/127.0.0.1:4000/api (only one slash).
    if (s.startsWith('http:/') && !s.startsWith('http://')) {
      s = 'http://${s.substring('http:/'.length)}';
    }
    if (s.startsWith('https:/') && !s.startsWith('https://')) {
      s = 'https://${s.substring('https:/'.length)}';
    }
    if (!s.contains('://')) {
      s = 'http://$s';
    }
    return s;
  }

  Uri _uri(String path) {
    final b = normalizeApiBase(baseUrl);
    final p = path.startsWith('/') ? path : '/$path';
    final u = Uri.parse('$b$p');
    if (!u.hasScheme || !u.hasAuthority) {
      throw FormatException(
        'API_BASE_URL must be an absolute URL with host (e.g. http://127.0.0.1:4000/api). Got: $baseUrl',
      );
    }
    return u;
  }

  Future<dynamic> request({
    required String method,
    required String path,
    Map<String, String>? headers,
    Map<String, dynamic>? body,
  }) async {
    final requestHeaders = <String, String>{...(headers ?? const {})};
    if (body != null) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    late final Future<http.Response> pending;
    switch (method.toUpperCase()) {
      case 'GET':
        pending = _client.get(_uri(path), headers: requestHeaders);
        break;
      case 'POST':
        pending = _client.post(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'PATCH':
        pending = _client.patch(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'PUT':
        pending = _client.put(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'DELETE':
        pending = _client.delete(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      default:
        throw Exception('Unsupported HTTP method: $method');
    }
    final res = await pending.timeout(
      requestTimeout,
      onTimeout: () => throw ApiException(
        message:
            'Connection timed out. Check Wi‑Fi/mobile data and that the app points to your API '
            '(build with --dart-define=API_BASE_URL=…).',
        statusCode: 408,
      ),
    );
    return _decodeJson(res);
  }

  /// Authenticated GET returning raw bytes (e.g. PDF). Does not JSON-decode the body.
  Future<List<int>> getBytes({
    required String path,
    Map<String, String>? headers,
  }) async {
    final res = await _client
        .get(_uri(path), headers: headers ?? const {})
        .timeout(
      requestTimeout,
      onTimeout: () => throw ApiException(
        message:
            'Connection timed out. Check Wi‑Fi/mobile data and that the app points to your API '
            '(build with --dart-define=API_BASE_URL=…).',
        statusCode: 408,
      ),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(
        message: 'Request failed',
        statusCode: res.statusCode,
      );
    }
    return res.bodyBytes;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    String? tenantSlug,
  }) async {
    final slug = (tenantSlug ?? '').trim().toLowerCase();
    final body = <String, dynamic>{'email': email, 'password': password};
    if (slug.isNotEmpty) body['tenant_slug'] = slug;
    final data = await request(
      method: 'POST',
      path: '/auth/login',
      body: body,
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> refresh(String refreshToken) async {
    final data = await request(
      method: 'POST',
      path: '/auth/refresh',
      body: {'refresh_token': refreshToken},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> logout({
    required String accessToken,
    required String refreshToken,
  }) async {
    await request(
      method: 'POST',
      path: '/auth/logout',
      headers: {
        'Authorization': 'Bearer $accessToken',
      },
      body: {'refresh_token': refreshToken},
    );
  }

  Future<Map<String, dynamic>> me(String accessToken) async {
    final data = await request(
      method: 'GET',
      path: '/auth/me',
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> registerPushToken({
    required String accessToken,
    required String token,
    required String platform,
  }) async {
    await request(
      method: 'POST',
      path: '/notifications/push-token',
      headers: {'Authorization': 'Bearer $accessToken'},
      body: {
        'token': token,
        'platform': platform,
      },
    );
  }

  Future<void> unregisterPushToken({
    required String accessToken,
    String? token,
  }) async {
    await request(
      method: 'DELETE',
      path: '/notifications/push-token',
      headers: {'Authorization': 'Bearer $accessToken'},
      body: token == null ? <String, dynamic>{} : {'token': token},
    );
  }

  static MediaType _imageMediaTypeForFilename(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.webp')) return MediaType('image', 'webp');
    if (lower.endsWith('.gif')) return MediaType('image', 'gif');
    return MediaType('image', 'jpeg');
  }

  Future<Map<String, dynamic>> uploadProfileAvatar({
    required String accessToken,
    required List<int> fileBytes,
    required String filename,
  }) async {
    final uri = _uri('/auth/me/avatar');
    final req = http.MultipartRequest('POST', uri);
    req.headers['Authorization'] = 'Bearer $accessToken';
    final fn = filename.isEmpty ? 'avatar.jpg' : filename;
    req.files.add(
      http.MultipartFile.fromBytes(
        'file',
        fileBytes,
        filename: fn,
        contentType: _imageMediaTypeForFilename(fn),
      ),
    );
    final streamed = await req.send().timeout(
      requestTimeout,
      onTimeout: () => throw ApiException(
        message: 'Upload timed out.',
        statusCode: 408,
      ),
    );
    final res = await http.Response.fromStream(streamed);
    return Map<String, dynamic>.from(_decodeJson(res) as Map);
  }

  Future<Map<String, dynamic>> deleteProfileAvatar(String accessToken) async {
    final data = await request(
      method: 'DELETE',
      path: '/auth/me/avatar',
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<dynamic>> settingsModules(String accessToken) async {
    final decoded = await request(
      method: 'GET',
      path: '/settings/modules',
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (decoded is List<dynamic>) return decoded;
    return <dynamic>[];
  }

  dynamic _decodeJson(http.Response response) {
    dynamic body;
    try {
      body = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    } catch (_) {
      throw ApiException(
        message: 'Invalid response from server',
        statusCode: response.statusCode,
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body is Map<String, dynamic> ? body['message']?.toString() : null;
      throw ApiException(
        message: message ?? 'Request failed',
        statusCode: response.statusCode,
        payload: body,
      );
    }
    return body;
  }
}
