import '../network/api_client.dart';

/// Optional override when the API is on a different host than where `/uploads` is served.
/// Example: `--dart-define=UPLOADS_ORIGIN=http://127.0.0.1:4000`
const String _uploadsOriginOverride = String.fromEnvironment('UPLOADS_ORIGIN', defaultValue: '');

/// Turns a relative upload path (e.g. `/uploads/users/avatar-1.jpg`) into a full URL for [Image.network].
String resolveUploadsPublicUrl(String? relative) {
  if (relative == null || relative.isEmpty) return '';
  var r = relative.trim();
  if (r.startsWith('http://') || r.startsWith('https://')) return r;
  // Wrong prefix e.g. /api/uploads/… (static files are not under /api)
  if (r.startsWith('/api/uploads/')) {
    r = '/uploads/${r.substring('/api/uploads/'.length)}';
  }

  final path = r.startsWith('/') ? r : '/$r';

  final override = _uploadsOriginOverride.trim();
  if (override.isNotEmpty) {
    final o = ApiClient.normalizeApiBase(override.endsWith('/') ? override.substring(0, override.length - 1) : override);
    final u = Uri.parse(o);
    if (u.hasScheme && u.hasAuthority) {
      return Uri(scheme: u.scheme, host: u.host, port: u.hasPort ? u.port : null).resolve(path).toString();
    }
  }

  final api = ApiClient.normalizeApiBase(ApiClient.baseUrl);
  final apiUri = Uri.parse(api);
  // API base is …/api — public files are served from the same host at /uploads/…
  final origin = Uri(
    scheme: apiUri.scheme,
    host: apiUri.host,
    port: apiUri.hasPort ? apiUri.port : null,
  );
  return origin.resolve(path).toString();
}
