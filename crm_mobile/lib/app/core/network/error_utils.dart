import 'api_exception.dart';

String userFriendlyError(Object error) {
  if (error is ApiException) {
    if (error.statusCode == 401) return 'Session expired. Please log in again.';
    if (error.statusCode == 403) return 'You do not have permission for this action.';
    if (error.statusCode == 404) return 'Requested data was not found.';
    if (error.statusCode >= 500) return 'Server error. Please try again later.';
    return error.message;
  }
  final text = error.toString();
  return text.replaceFirst('Exception: ', '');
}
