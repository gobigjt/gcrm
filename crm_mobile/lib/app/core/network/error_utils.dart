import 'api_exception.dart';

/// [loginAttempt]: when true, 401 means invalid credentials (e.g. POST /auth/login), not an expired session.
String userFriendlyError(Object error, {bool loginAttempt = false}) {
  if (error is ApiException) {
    if (error.statusCode == 401) {
      if (loginAttempt) {
        final m = error.message.trim();
        if (m.isNotEmpty && m != 'Request failed') return m;
        return 'Invalid email or password.';
      }
      return 'Session expired. Please log in again.';
    }
    if (error.statusCode == 403) return 'You do not have permission for this action.';
    if (error.statusCode == 404) return 'Requested data was not found.';
    if (error.statusCode >= 500) return 'Server error. Please try again later.';
    return error.message;
  }
  final text = error.toString();
  return text.replaceFirst('Exception: ', '');
}
