import 'package:flutter/widgets.dart';
import 'package:get/get.dart';

import '../modules/auth/auth_controller.dart';
import 'app_routes.dart';

/// Restricts a route to users whose `role` is in [allowedRoles] (exact match to backend `users.role`).
class RoleMiddleware extends GetMiddleware {
  RoleMiddleware({required this.allowedRoles});

  final List<String> allowedRoles;

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

    if (!allowedRoles.contains(auth.role.value)) {
      Get.snackbar('Access denied', 'This screen is restricted for your role.');
      return const RouteSettings(name: AppRoutes.dashboard);
    }

    return null;
  }
}
