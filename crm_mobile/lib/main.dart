import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app/core/theme/app_theme.dart';
import 'app/core/navigation/deep_link_controller.dart';
import 'app/modules/auth/auth_controller.dart';
import 'app/routes/app_pages.dart';
import 'app/routes/app_routes.dart';

void main() {
  runApp(const CrmMobileApp());
}

class CrmMobileApp extends StatelessWidget {
  const CrmMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'EZCRM',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      initialBinding: BindingsBuilder(() {
        Get.put(AuthController(), permanent: true);
        Get.put(DeepLinkController(), permanent: true);
      }),
      initialRoute: AppRoutes.splash,
      getPages: AppPages.routes,
    );
  }
}
