import 'package:get/get.dart';

/// Resolves a lead id from optional [link] on notifications.
int? parseLeadIdFromNotificationLink(String? link) {
  if (link == null || link.trim().isEmpty) return null;
  final t = link.trim();
  final q = RegExp(r'[?&]lead=(\d+)', caseSensitive: false).firstMatch(t);
  if (q != null) {
    final id = int.tryParse(q.group(1) ?? '');
    if (id != null && id > 0) return id;
  }
  final openQ = RegExp(r'[?&]openLead=(\d+)', caseSensitive: false).firstMatch(t);
  if (openQ != null) {
    final id = int.tryParse(openQ.group(1) ?? '');
    if (id != null && id > 0) return id;
  }
  final path = RegExp(r'/lead/(\d+)(?:\?|#|$)', caseSensitive: false).firstMatch(t);
  if (path != null) {
    final id = int.tryParse(path.group(1) ?? '');
    if (id != null && id > 0) return id;
  }
  return null;
}

/// Opens lead detail when [link] encodes a lead; returns true if navigation ran.
bool openNotificationTarget(String? link) {
  final id = parseLeadIdFromNotificationLink(link);
  if (id == null) return false;
  Get.toNamed('/lead/$id');
  return true;
}
