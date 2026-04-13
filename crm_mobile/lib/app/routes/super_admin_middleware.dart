import 'package:flutter/widgets.dart';
import 'package:get/get.dart';

import '../core/auth/showcase_role.dart';
import '../modules/auth/auth_controller.dart';
import 'app_routes.dart';

class SuperAdminMiddleware extends GetMiddleware {
  @override
  RouteSettings? redirect(String? route) {
    if (!Get.isRegistered<AuthController>()) {
      return const RouteSettings(name: AppRoutes.login);
    }
    final auth = Get.find<AuthController>();
    if (!auth.isLoggedIn.value) {
      return const RouteSettings(name: AppRoutes.login);
    }
    if (ShowcaseRoles.fromBackendRole(auth.role.value) != ShowcaseRole.superAdmin) {
      Get.snackbar('Access denied', 'Platform screens are restricted.');
      return const RouteSettings(name: AppRoutes.dashboard);
    }
    return null;
  }
}
