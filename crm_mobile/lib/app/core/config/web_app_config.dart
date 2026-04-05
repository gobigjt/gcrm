/// Optional browser base URL for CRM → Sales handoff (same pattern as backend `WEB_APP_ORIGIN`).
/// Example: `--dart-define=WEB_APP_ORIGIN=http://localhost:5173` or `https://app.example.com`
/// No trailing slash.
class WebAppConfig {
  static const String _origin = String.fromEnvironment('WEB_APP_ORIGIN', defaultValue: '');

  static bool get isConfigured => _origin.trim().isNotEmpty;

  /// `/sales?fromLead=` for the web app’s Sales page banner + customer prefill.
  static Uri? salesHandoffUri(int leadId) {
    if (!isConfigured) return null;
    final base = _origin.trim().replaceAll(RegExp(r'/$'), '');
    return Uri.parse('$base/sales?fromLead=$leadId');
  }
}
