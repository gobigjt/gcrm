import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../modules/auth/auth_controller.dart';
import 'notification_navigation.dart';

/// Cold start + runtime deep links (`https://…/crm?lead=1`, `ezcrm://…/lead/1`, etc.).
/// Waits until auth bootstrap finishes and user is logged in before navigating.
class DeepLinkController extends GetxController {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  String? _pending;

  @override
  void onInit() {
    super.onInit();
    final auth = Get.find<AuthController>();
    ever<bool>(auth.isBootstrapping, (_) => tryFlush());
    ever<bool>(auth.isLoggedIn, (logged) {
      if (!logged) {
        _pending = null;
        return;
      }
      tryFlush();
    });
    unawaited(_listen());
  }

  Future<void> _listen() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _handleUri(initial.toString());
    } catch (_) {
      /* plugin may fail on unsupported platforms */
    }

    try {
      _sub = _appLinks.uriLinkStream.listen(
        (uri) => _handleUri(uri.toString()),
        onError: (_) {},
      );
    } catch (_) {}
  }

  void _handleUri(String link) {
    if (parseLeadIdFromNotificationLink(link) == null) return;

    final auth = Get.find<AuthController>();
    if (auth.isBootstrapping.value || !auth.isLoggedIn.value) {
      _pending = link;
      return;
    }
    if (!auth.hasPermission(AppPermissions.crm)) return;

    _pending = null;
    openNotificationTarget(link);
  }

  void tryFlush() {
    if (_pending == null) return;
    final auth = Get.find<AuthController>();
    if (auth.isBootstrapping.value || !auth.isLoggedIn.value) return;
    if (!auth.hasPermission(AppPermissions.crm)) {
      _pending = null;
      return;
    }
    final link = _pending!;
    _pending = null;
    openNotificationTarget(link);
  }

  @override
  void onClose() {
    _sub?.cancel();
    super.onClose();
  }
}
