/// Optional browser base URL for CRM → Sales handoff (same pattern as backend `WEB_APP_ORIGIN`).
/// Example: `--dart-define=WEB_APP_ORIGIN=http://localhost:5173` or `https://app.example.com`
/// No trailing slash.
class WebAppConfig {
  // Override with:
  // --dart-define=API_BASE_URL=http://127.0.0.1:4000/api
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:4000/api',
  );
  // https://gcrm-production-31ec.up.railway.app/api

  // Override with:
  // --dart-define=WEB_APP_ORIGIN=https://your-frontend-host
  static const String webAppOrigin = String.fromEnvironment(
    'WEB_APP_ORIGIN',
    defaultValue: 'http://localhost:5173',
  );

  static bool get isConfigured => webAppOrigin.trim().isNotEmpty;

  /// `/sales?fromLead=` for the web app’s Sales page banner + customer prefill.
  static Uri? salesHandoffUri(int leadId) {
    if (!isConfigured) return null;
    final base = webAppOrigin.trim().replaceAll(RegExp(r'/$'), '');
    return Uri.parse('$base/sales?fromLead=$leadId');
  }

  /// Deep link to a sales document detail on the web app (print / PDF from browser).
  /// [segment] is `quotes`, `orders`, or `invoices` (matches React `SalesRoutes`).
  static Uri? salesDetailWebUri({required String segment, required int id}) {
    if (!isConfigured || id <= 0) return null;
    final base = webAppOrigin.trim().replaceAll(RegExp(r'/$'), '');
    final s = segment.replaceAll(RegExp(r'^/+|/+$'), '');
    return Uri.parse('$base/sales/$s/$id');
  }

  /// Deep link to a sales document detail that auto-starts PDF download in web app.
  static Uri? salesDetailPdfUri({required String segment, required int id}) {
    final base = salesDetailWebUri(segment: segment, id: id);
    if (base == null) return null;
    return base.replace(queryParameters: {...base.queryParameters, 'autoPdf': '1'});
  }
}
