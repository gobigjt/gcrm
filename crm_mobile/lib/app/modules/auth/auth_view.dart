import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_home_route.dart';
import '../../widgets/crm_suite_logo_mark.dart';
import 'auth_controller.dart';

/// Login — matches EZcrmcrm_mobile_showcase_1.html "Onboarding · Login".
class AuthView extends GetView<AuthController> {
  const AuthView({super.key});

  static const Color _accent = Color(0xFF185FA5);
  static const Color _fieldFillLight = Color(0xFFF1EFE8);
  static const Color _fieldFillDark = Color(0xFF2A2926);
  static const Color _borderLight = Color(0xFFE0DED6);
  static const Color _borderDark = Color(0xFF3A3936);
  static const Color _subtitleLight = Color(0xFF73726C);
  static const Color _subtitleDark = Color(0xFFB9B8B2);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF1E1E1C) : Colors.white;
    final subtitle = isDark ? _subtitleDark : _subtitleLight;
    final fieldFill = isDark ? _fieldFillDark : _fieldFillLight;
    final borderColor = isDark ? _borderDark : _borderLight;

    InputDecoration fieldDeco(String label, {String? hint}) {
      return InputDecoration(
        isDense: true,
        labelText: label,
        hintText: hint,
        floatingLabelBehavior: FloatingLabelBehavior.always,
        labelStyle: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: subtitle,
        ),
        hintStyle: TextStyle(fontSize: 12, color: subtitle.withValues(alpha: 0.7)),
        filled: true,
        fillColor: fieldFill,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: _accent, width: 1.2),
        ),
      );
    }

    return Obx(() {
      if (controller.isBootstrapping.value) {
        return Scaffold(
          backgroundColor: bg,
          body: const Center(child: CircularProgressIndicator()),
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
        backgroundColor: bg,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _accent,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: const Center(
                          child: CrmSuiteLogoMark(
                            size: 22,
                            preset: CrmSuiteLogoMarkPreset.login,
                            primary: Colors.white,
                            dimmedOpacity: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 11),
                      Text(
                        'CRM Suite',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: isDark ? const Color(0xFFE5E4DF) : const Color(0xFF1E1E1C),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Sign in to your account',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 10, color: subtitle),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                TextField(
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  onChanged: (v) => controller.email.value = v,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? const Color(0xFFE5E4DF) : const Color(0xFF1E1E1C),
                  ),
                  decoration: fieldDeco('Email', hint: 'you@company.com'),
                ),
                const SizedBox(height: 14),
                TextField(
                  obscureText: true,
                  onChanged: (v) => controller.password.value = v,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? const Color(0xFFE5E4DF) : const Color(0xFF1E1E1C),
                  ),
                  decoration: fieldDeco('Password', hint: '••••••••'),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      Get.snackbar(
                        'Forgot password',
                        'Contact your administrator to reset your password.',
                        snackPosition: SnackPosition.BOTTOM,
                      );
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Forgot password?',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: _accent,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Obx(
                  () => SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: _accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onPressed: controller.isLoading.value ? null : controller.login,
                      child: controller.isLoading.value
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Sign in',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: Divider(color: borderColor, thickness: 0.8, height: 1),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        'or',
                        style: TextStyle(fontSize: 10, color: subtitle),
                      ),
                    ),
                    Expanded(
                      child: Divider(color: borderColor, thickness: 0.8, height: 1),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? const Color(0xFFE5E4DF) : const Color(0xFF1E1E1C),
                    backgroundColor: isDark ? const Color(0xFF2A2926) : _fieldFillLight,
                    side: BorderSide(color: borderColor),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () {
                    Get.snackbar(
                      'Biometric login',
                      'Not implemented in this prototype. You can still sign in with password.',
                      snackPosition: SnackPosition.BOTTOM,
                    );
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.fingerprint_rounded, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'Biometric login',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }
}
