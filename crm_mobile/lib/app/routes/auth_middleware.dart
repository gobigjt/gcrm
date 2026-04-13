import 'package:flutter/widgets.dart';
import 'package:get/get.dart';

import '../modules/auth/auth_controller.dart';
import 'app_routes.dart';

/// Any authenticated user may open the route (no module permission).
class AuthMiddleware extends GetMiddleware {
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

    return null;
  }
}
