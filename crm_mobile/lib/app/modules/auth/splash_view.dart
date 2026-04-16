import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';
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
            child: Stack(
              fit: StackFit.expand,
              children: [
                Center(child: _brandBlock()),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 40),
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white.withValues(alpha: 0.82),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }

      if (controller.isLoggedIn.value) {
        // Navigation runs once from [AuthController.restoreSession] after bootstrap.
        return Scaffold(
          backgroundColor: _splashBlue,
          body: SafeArea(
            child: Stack(
              fit: StackFit.expand,
              children: const [
                Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: Colors.white70,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }

      return Scaffold(
        backgroundColor: _splashBlue,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Center(child: _brandBlock()),
                ),
                Center(
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
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
                      color: Colors.white.withValues(alpha: 0.75),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }

  Widget _brandBlock() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: SizedBox(
              width: 280,
              height: 100,
              child: Image(
                image: AssetImage('assets/images/ezcrm-logo.png'),
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "India's smartest sales\n& operations platform",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              height: 1.35,
              color: Colors.white.withValues(alpha: 0.82),
            ),
          ),
        ],
      ),
    );
  }
}
