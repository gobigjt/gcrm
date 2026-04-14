/// API base URL for the mobile app.
/// Override with: `--dart-define=API_BASE_URL=http://127.0.0.1:4000/api`
/// No trailing slash on the value (trailing slashes are normalized away where needed).
class WebAppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://gcrm-production-31ec.up.railway.app/api',
  );
}
