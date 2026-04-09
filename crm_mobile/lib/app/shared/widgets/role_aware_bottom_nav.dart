import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/showcase_role.dart';
import '../../modules/auth/auth_controller.dart';

/// Bottom bar from EZcrmcrm_mobile_showcase_1.html — varies by backend role.
class RoleAwareBottomNav extends StatelessWidget {
  const RoleAwareBottomNav({super.key, required this.currentRoute});

  final String currentRoute;

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    final role = ShowcaseRoles.fromBackendRole(auth.role.value);
    final items = ShowcaseRoles.bottomNav(role);
    final activeIndex = ShowcaseRoles.bottomNavIndex(role, currentRoute);

    final tight = items.length > 5;
    return SafeArea(
      top: false,
      child: Container(
        height: 72,
        padding: EdgeInsets.symmetric(horizontal: tight ? 4 : 10),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: Border(top: BorderSide(color: Theme.of(context).dividerColor, width: 0.5)),
        ),
        child: Row(
          children: List.generate(items.length, (idx) {
            final active = idx == activeIndex;
            const accent = Color(0xFF0C447C);
            final labelColor = active ? accent : Theme.of(context).hintColor;
            final iconColor = active ? accent : Theme.of(context).hintColor;
            return Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => Get.offAllNamed(items[idx].route),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: active ? const Color(0xFFE6F1FB) : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        items[idx].icon,
                        size: 22,
                        color: iconColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      items[idx].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: labelColor,
                            fontWeight: active ? FontWeight.w800 : FontWeight.w500,
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
