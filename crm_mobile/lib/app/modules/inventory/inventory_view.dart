import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'inventory_controller.dart';

class InventoryView extends GetView<InventoryController> {
  const InventoryView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: Obx(
        () => AppNavigationDrawer(
          currentRoute: AppRoutes.inventory,
          section: controller.tabIndex.value == 0 ? 'products' : 'warehouses',
        ),
      ),
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(
            onPressed: controller.load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.inventory),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Obx(
              () => SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('Products'), icon: Icon(Icons.inventory_2_outlined, size: 18)),
                  ButtonSegment(value: 1, label: Text('Warehouses'), icon: Icon(Icons.warehouse_outlined, size: 18)),
                ],
                selected: {controller.tabIndex.value},
                onSelectionChanged: (s) {
                  if (s.isEmpty) return;
                  controller.selectTab(s.first);
                },
              ),
            ),
          ),
          Obx(
            () => AppErrorBanner(
              message: controller.errorMessage.value ?? '',
              onRetry: controller.load,
            ),
          ),
          Obx(() => controller.loading.value ? const LinearProgressIndicator(minHeight: 2) : const SizedBox.shrink()),
          Expanded(
            child: Obx(() {
              if (controller.isProductsTab) {
                if (controller.products.isEmpty && !controller.loading.value) {
                  return Center(
                    child: Text(
                      'No products',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).hintColor),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  itemCount: controller.products.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final p = controller.products[i];
                    final name = (p['name'] ?? '—').toString();
                    final sku = (p['sku'] ?? '').toString();
                    final price = p['sale_price'];
                    return ListTile(
                      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(sku.isEmpty ? 'SKU —' : 'SKU $sku'),
                      trailing: Text(price != null ? '₹$price' : '—'),
                    );
                  },
                );
              }

              if (controller.warehouses.isEmpty && !controller.loading.value) {
                return Center(
                  child: Text(
                    'No warehouses',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).hintColor),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                itemCount: controller.warehouses.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final w = controller.warehouses[i];
                  final name = (w['name'] ?? '—').toString();
                  final loc = (w['location'] ?? '').toString();
                  return ListTile(
                    title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(loc.isEmpty ? '—' : loc),
                  );
                },
              );
            }),
          ),
        ],
      ),
    );
  }
}
