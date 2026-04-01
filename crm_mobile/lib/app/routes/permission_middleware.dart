import 'package:flutter/widgets.dart';
import 'package:get/get.dart';

import '../modules/auth/auth_controller.dart';
import 'app_routes.dart';

class PermissionMiddleware extends GetMiddleware {
  PermissionMiddleware({required this.permission});

  final String permission;

  @override
  RouteSettings? redirect(String? route) {
    if (!Get.isRegistered<AuthController>()) {
      return const RouteSettings(name: AppRoutes.login);
    }

    final auth = Get.find<AuthController>();
    if (auth.isBootstrapping.value) return null;
    if (!auth.isLoggedIn.value) {
      return const RouteSettings(name: AppRoutes.login);
    }

    if (!auth.hasPermission(permission)) {
      Get.snackbar('Access denied', 'You do not have permission to open this screen.');
      return const RouteSettings(name: AppRoutes.dashboard);
    }

    return null;
  }
}
