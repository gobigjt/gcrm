import '../network/api_client.dart';

/// Turns a relative upload path (e.g. `/uploads/users/avatar-1.jpg`) into a full URL for [Image.network].
String resolveUploadsPublicUrl(String? relative) {
  if (relative == null || relative.isEmpty) return '';
  var r = relative.trim();
  if (r.startsWith('http://') || r.startsWith('https://')) return r;
  // Wrong prefix e.g. /api/uploads/… (static files are not under /api)
  if (r.startsWith('/api/uploads/')) {
    r = '/uploads/${r.substring('/api/uploads/'.length)}';
  }

  final api = ApiClient.normalizeApiBase(ApiClient.baseUrl);
  final apiUri = Uri.parse(api);
  // API base is …/api — public files are served from the same host at /uploads/…
  final origin = Uri(
    scheme: apiUri.scheme,
    host: apiUri.host,
    port: apiUri.hasPort ? apiUri.port : null,
  );
  final path = r.startsWith('/') ? r : '/$r';
  return origin.resolve(path).toString();
}
