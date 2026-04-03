import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_exception.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  // Android emulator localhost mapping; override with --dart-define=API_BASE_URL=...
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api',
  );

  Uri _uri(String path) {
    // Defensive: `--dart-define` / env values sometimes contain whitespace.
    // Also avoid accidental double slashes when `baseUrl` ends with `/`.
    final raw = baseUrl.trim();
    final b = raw.endsWith('/') ? raw.substring(0, raw.length - 1) : raw;
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$b$p');
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

    late http.Response res;
    switch (method.toUpperCase()) {
      case 'GET':
        res = await _client.get(_uri(path), headers: requestHeaders);
        break;
      case 'POST':
        res = await _client.post(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'PATCH':
        res = await _client.patch(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'PUT':
        res = await _client.put(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'DELETE':
        res = await _client.delete(
          _uri(path),
          headers: requestHeaders,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      default:
        throw Exception('Unsupported HTTP method: $method');
    }
    return _decodeJson(res);
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final data = await request(
      method: 'POST',
      path: '/auth/login',
      body: {'email': email, 'password': password},
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
