import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_home_route.dart';
import 'auth_controller.dart';

/// Login screen — dark-mode optimised with gradient hero section.
class AuthView extends GetView<AuthController> {
  const AuthView({super.key});

  static const Color _accentBright = Color(0xFF2563EB);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    final fieldFill = isDark ? scheme.surfaceContainerHigh : const Color(0xFFF8F9FB);
    final borderColor = isDark ? scheme.outlineVariant : const Color(0xFFE2E8F0);
    final subtitleColor = isDark ? scheme.onSurfaceVariant : const Color(0xFF334155);
    final textColor = isDark ? scheme.onSurface : const Color(0xFF1E293B);

    InputDecoration fieldDeco(String label,
        {String? hint, Widget? suffixIcon}) {
      return InputDecoration(
        isDense: true,
        labelText: label,
        hintText: hint,
        suffixIcon: suffixIcon,
        floatingLabelBehavior: FloatingLabelBehavior.always,
        labelStyle: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: subtitleColor,
          letterSpacing: 0.2,
        ),
        hintStyle: TextStyle(
            fontSize: 13, color: subtitleColor.withValues(alpha: 0.6)),
        filled: true,
        fillColor: fieldFill,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _accentBright, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.2),
        ),
      );
    }

    return Obx(() {
      if (controller.isBootstrapping.value) {
        return Scaffold(
          backgroundColor:
              isDark ? scheme.surface : const Color(0xFF0C447C),
          body: const Center(
              child: CircularProgressIndicator(color: Colors.white)),
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
        backgroundColor:
            isDark ? scheme.surface : const Color(0xFFF8FAFC),
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Hero gradient section ──────────────────────────────────
              _HeroSection(isDark: isDark),

              // ── Form card ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                child: Transform.translate(
                  offset: const Offset(0, -24),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isDark
                          ? scheme.surfaceContainerLow
                          : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black
                              .withValues(alpha: isDark ? 0.4 : 0.08),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                      border: isDark
                          ? Border.all(
                              color: scheme.outlineVariant
                                  .withValues(alpha: 0.35),
                              width: 0.8,
                            )
                          : null,
                    ),
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Welcome back',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: textColor,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Sign in to continue to your workspace',
                          style: TextStyle(
                            fontSize: 13,
                            color: subtitleColor,
                          ),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          onChanged: (v) => controller.email.value = v,
                          style: TextStyle(fontSize: 14, color: textColor),
                          decoration: fieldDeco('EMAIL ADDRESS',
                              hint: 'you@company.com'),
                        ),
                        const SizedBox(height: 14),
                        Obx(
                          () => TextField(
                            obscureText: controller.passwordObscured.value,
                            onChanged: (v) => controller.password.value = v,
                            style: TextStyle(fontSize: 14, color: textColor),
                            decoration: fieldDeco(
                              'PASSWORD',
                              hint: '••••••••',
                              suffixIcon: IconButton(
                                tooltip: controller.passwordObscured.value
                                    ? 'Show password'
                                    : 'Hide password',
                                onPressed: () =>
                                    controller.passwordObscured.toggle(),
                                icon: Icon(
                                  controller.passwordObscured.value
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 20,
                                  color: subtitleColor,
                                ),
                              ),
                            ),
                          ),
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
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              'Forgot password?',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _accentBright,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Obx(
                          () => _SignInButton(
                            isLoading: controller.isLoading.value,
                            onTap: controller.isLoading.value
                                ? null
                                : controller.login,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: Divider(
                                  color: borderColor,
                                  thickness: 0.8,
                                  height: 1),
                            ),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'or',
                                style: TextStyle(
                                    fontSize: 11, color: subtitleColor),
                              ),
                            ),
                            Expanded(
                              child: Divider(
                                  color: borderColor,
                                  thickness: 0.8,
                                  height: 1),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _BiometricButton(
                          isDark: isDark,
                          borderColor: borderColor,
                          textColor: textColor,
                          fieldFill: fieldFill,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    });
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          24, MediaQuery.of(context).padding.top + 40, 24, 52),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF0C1C35), Color(0xFF0A1424)]
              : const [Color(0xFF0C447C), Color(0xFF185FA5)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Same logo asset used on splash screen.
          const SizedBox(
            width: 200,
            height: 100,
            child: Image(
              image: AssetImage('assets/images/ezcrm-logo.png'),
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'EzCRM',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "India's smartest sales & operations platform",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              height: 1.4,
              color: Colors.white.withValues(alpha: 0.72),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignInButton extends StatelessWidget {
  const _SignInButton({required this.isLoading, this.onTap});

  final bool isLoading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF185FA5)],
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF185FA5).withValues(alpha: 0.45),
            blurRadius: 16,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Center(
            child: isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.2, color: Colors.white),
                  )
                : const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Sign in',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.1,
                        ),
                      ),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded,
                          size: 18, color: Colors.white),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _BiometricButton extends StatelessWidget {
  const _BiometricButton({
    required this.isDark,
    required this.borderColor,
    required this.textColor,
    required this.fieldFill,
  });

  final bool isDark;
  final Color borderColor;
  final Color textColor;
  final Color fieldFill;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        foregroundColor: textColor,
        backgroundColor: fieldFill,
        side: BorderSide(color: borderColor),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      onPressed: () {
        Get.snackbar(
          'Biometric login',
          'Not implemented in this prototype. You can still sign in with password.',
          snackPosition: SnackPosition.BOTTOM,
        );
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.fingerprint_rounded, size: 20, color: textColor),
          const SizedBox(width: 10),
          Text(
            'Continue with biometrics',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: textColor),
          ),
        ],
      ),
    );
  }
}
