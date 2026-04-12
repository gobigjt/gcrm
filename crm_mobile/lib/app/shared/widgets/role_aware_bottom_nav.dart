import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/showcase_role.dart';
import '../../modules/auth/auth_controller.dart';

/// Bottom bar — varies by backend role.
class RoleAwareBottomNav extends StatelessWidget {
  const RoleAwareBottomNav({super.key, required this.currentRoute});

  final String currentRoute;

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    final role = ShowcaseRoles.fromBackendRole(auth.role.value);
    final items = ShowcaseRoles.bottomNav(role);
    final activeIndex = ShowcaseRoles.bottomNavIndex(role, currentRoute);

    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tight = items.length > 5;

    // Theme-aware accent colors
    final activeIconColor = isDark ? scheme.primary : const Color(0xFF185FA5);
    final activeLabelColor = isDark ? scheme.primary : const Color(0xFF0C447C);
    final activeBg = isDark
        ? scheme.primary.withValues(alpha: 0.15)
        : const Color(0xFFE6F1FB);
    final inactiveColor =
        isDark ? scheme.onSurfaceVariant : const Color(0xFF334155);

    return SafeArea(
      top: false,
      child: Container(
        height: 72,
        padding: EdgeInsets.symmetric(horizontal: tight ? 4 : 10),
        decoration: BoxDecoration(
          color: isDark ? scheme.surface : Colors.white,
          border: Border(
            top: BorderSide(
              color: isDark
                  ? scheme.outlineVariant.withValues(alpha: 0.35)
                  : scheme.outlineVariant.withValues(alpha: 0.6),
              width: 0.8,
            ),
          ),
          boxShadow: isDark
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, -3),
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, -2),
                  ),
                ],
        ),
        child: Row(
          children: List.generate(items.length, (idx) {
            final active = idx == activeIndex;
            return Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => Get.offAllNamed(items[idx].route),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: active ? activeBg : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        items[idx].icon,
                        size: 22,
                        color: active ? activeIconColor : inactiveColor,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      items[idx].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: active ? activeLabelColor : inactiveColor,
                            fontWeight: active
                                ? FontWeight.w800
                                : FontWeight.w500,
                            fontSize: tight ? 10 : 11,
                          ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
