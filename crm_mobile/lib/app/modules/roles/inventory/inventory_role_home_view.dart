import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../../showcase/showcase_widgets.dart';
import '../../inventory/inventory_controller.dart';

/// Inventory manager — stock overview landing (showcase).
class InventoryRoleHomeView extends GetView<InventoryController> {
  const InventoryRoleHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.inventoryHome),
      body: RefreshIndicator(
        onRefresh: controller.loadAll,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.loadAll,
              ),
            ),
            Obx(() {
              final low = controller.lowStock;
              final critical = low.where((r) => r.totalStock <= 0).length;
              final lowN = low.length;
              final okN = (controller.products.length - lowN).clamp(0, 999999);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const ShowcaseSectionTitle('Stock health'),
                    Row(
                      children: [
                        Expanded(
                          child: _HealthPill(
                            label: 'Critical',
                            count: critical,
                            bg: const Color(0xFFFCEBEB),
                            fg: const Color(0xFF791F1F),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _HealthPill(
                            label: 'Low',
                            count: lowN,
                            bg: const Color(0xFFFAEEDA),
                            fg: const Color(0xFF633806),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _HealthPill(
                            label: 'OK',
                            count: okN,
                            bg: const Color(0xFFEAF3DE),
                            fg: const Color(0xFF27500A),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
            Obx(() {
              return GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 1.4,
                children: [
                  _kpi(context, 'Total SKUs', '${controller.products.length}'),
                  _kpi(context, 'Low stock', '${controller.lowStock.length}', color: const Color(0xFFE24B4A)),
                  _kpi(context, 'Warehouses', '${controller.warehouses.length}'),
                  _kpi(context, 'Movements', '${controller.movements.length}', sub: 'recent log'),
                ],
              );
            }),
            const SizedBox(height: 12),
            Obx(() {
              if (controller.lowStock.isEmpty) return const SizedBox.shrink();
              return Card(
                color: const Color(0xFFFCEBEB),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Critical stock alert', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF791F1F))),
                      const SizedBox(height: 4),
                      Text(
                        controller.lowStock.map((e) => e.name).take(5).join(' · '),
                        style: const TextStyle(fontSize: 12, color: Color(0xFF791F1F)),
                      ),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            Text(
              'STOCK LEVELS',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Theme.of(context).hintColor,
                  ),
            ),
            const SizedBox(height: 8),
            Obx(() {
              if (controller.lowStock.isEmpty) {
                return Text(
                  'No low-stock rows. Open full inventory for product list.',
                  style: TextStyle(color: Theme.of(context).hintColor),
                );
              }

              return Column(
                children: [
                  ...controller.lowStock.take(6).map((r) {
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(r.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      subtitle: Text('${r.skuDisplay} · alert ${r.lowStockAlert}', style: const TextStyle(fontSize: 11)),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('${r.totalStock}', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFE24B4A))),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFCEBEB),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text('Low', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF791F1F))),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              );
            }),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Get.offAllNamed(AppRoutes.inventory),
              child: const Text('Open full inventory'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Get.toNamed(AppRoutes.stockAdjust),
              child: const Text('Stock adjustment'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Get.offAllNamed(AppRoutes.purchase),
              child: const Text('Purchase orders'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _kpi(BuildContext context, String k, String v, {Color? color, String? sub}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(k, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
            const Spacer(),
            Text(v, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
            if (sub != null) Text(sub, style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor)),
          ],
        ),
      ),
    );
  }
}

class _HealthPill extends StatelessWidget {
  const _HealthPill({
    required this.label,
    required this.count,
    required this.bg,
    required this.fg,
  });

  final String label;
  final int count;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
          const SizedBox(height: 4),
          Text('$count', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: fg)),
        ],
      ),
    );
  }
}
