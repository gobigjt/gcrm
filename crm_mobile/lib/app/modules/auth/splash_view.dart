import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_home_route.dart';
import '../../routes/app_routes.dart';
import '../../widgets/crm_suite_logo_mark.dart';
import 'auth_controller.dart';

/// Splash + cold start — matches EZcrmcrm_mobile_showcase_1.html "Onboarding · Splash".
class SplashView extends GetView<AuthController> {
  const SplashView({super.key});

  static const Color _splashBlue = Color(0xFF0C447C);

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isBootstrapping.value) {
        return Scaffold(
          backgroundColor: _splashBlue,
          body: SafeArea(
            child: Column(
              children: [
                const Spacer(),
                _brandBlock(),
                const Spacer(),
                const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    color: Colors.white54,
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        );
      }

      if (controller.isLoggedIn.value) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Get.offAllNamed(
            resolveRoleHome(
              roleName: controller.role.value,
              hasPermission: controller.hasPermission,
            ),
          );
        });
        return const SizedBox.shrink();
      }

      return Scaffold(
        backgroundColor: _splashBlue,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              children: [
                const Spacer(),
                _brandBlock(),
                const SizedBox(height: 40),
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: Material(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(9),
                    child: InkWell(
                      onTap: () => Get.offNamed(AppRoutes.login),
                      borderRadius: BorderRadius.circular(9),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                        ),
                        child: const Text(
                          'Get started',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => Get.offNamed(AppRoutes.login),
                  child: Text(
                    'Already have an account? Sign in',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.5),
                    ),
                  ),
                ),
                const Spacer(),
              ],
            ),
          ),
        ),
      );
    });
  }

  Widget _brandBlock() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: Colors.white.withValues(alpha: 0.15),
            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
          ),
          child: const Center(
            child: CrmSuiteLogoMark(
              size: 30,
              preset: CrmSuiteLogoMarkPreset.splash,
              primary: Colors.white,
              dimmedOpacity: 0.5,
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'CRM Suite',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          "India's smartest sales\n& operations platform",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            height: 1.35,
            color: Colors.white.withValues(alpha: 0.65),
          ),
        ),
      ],
    );
  }
}
