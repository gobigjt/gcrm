import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';

class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.currentIndex});

  final int currentIndex;

  void _go(int idx) {
    switch (idx) {
      case 0:
        Get.offNamed(AppRoutes.dashboard);
        break;
      case 1:
        Get.offNamed(AppRoutes.crm);
        break;
      case 2:
        Get.offNamed(AppRoutes.tasks);
        break;
      case 3:
        Get.offNamed(AppRoutes.sales);
        break;
      case 4:
        Get.offNamed(AppRoutes.settings);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = const ['Home', 'Leads', 'Sales', 'Stock', 'Me'];
    return SafeArea(
      top: false,
      child: Container(
        height: 72,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: Border(top: BorderSide(color: Theme.of(context).dividerColor, width: 0.5)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(items.length, (idx) {
            final active = idx == currentIndex;
            final dotBg = active ? const Color(0xFFE6F1FB) : Theme.of(context).dividerColor;
            final labelColor = active ? const Color(0xFF0C447C) : Theme.of(context).hintColor;

            return Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => _go(idx),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: dotBg, shape: BoxShape.circle),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      items[idx],
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: labelColor,
                            fontWeight: active ? FontWeight.w800 : FontWeight.w500,
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

