import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'inventory_controller.dart';

class InventoryView extends GetView<InventoryController> {
  const InventoryView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Inventory'),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            isScrollable: true,
            tabs: const [
              Tab(text: 'Products'),
              Tab(text: 'Warehouses'),
              Tab(text: 'Low Stock'),
              Tab(text: 'Movements'),
            ],
          ),
        ),
        floatingActionButton: Obx(() {
          if (controller.selectedTab.value == 0) {
            return FloatingActionButton.extended(
              onPressed: () => _openCreateProductSheet(context),
              icon: const Icon(Icons.add_box_rounded),
              label: const Text('New Product'),
            );
          }
          if (controller.selectedTab.value == 3) {
            return FloatingActionButton.extended(
              onPressed: () => _openAdjustStockSheet(context),
              icon: const Icon(Icons.swap_horiz_rounded),
              label: const Text('Adjust Stock'),
            );
          }
          return const SizedBox.shrink();
        }),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Obx(
                () => AppErrorBanner(
                  message: controller.errorMessage.value,
                  onRetry: controller.loadAll,
                ),
              ),
            ),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value) {
                  return const Center(child: CircularProgressIndicator());
                }
                return TabBarView(
                  children: [
                    _ProductsTab(controller: controller),
                    _WarehousesTab(controller: controller),
                    _LowStockTab(controller: controller),
                    _MovementsTab(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
        bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.inventory),
      ),
    );
  }

  Future<void> _openCreateProductSheet(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final skuCtrl = TextEditingController();
    final hsnCtrl = TextEditingController();
    final unitCtrl = TextEditingController(text: 'pcs');
    final ppCtrl = TextEditingController(text: '0');
    final spCtrl = TextEditingController(text: '0');
    final gstCtrl = TextEditingController(text: '0');
    final lowCtrl = TextEditingController(text: '0');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Create Product', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
            const SizedBox(height: 8),
            TextField(controller: skuCtrl, decoration: const InputDecoration(labelText: 'SKU')),
            const SizedBox(height: 8),
            TextField(controller: hsnCtrl, decoration: const InputDecoration(labelText: 'HSN Code')),
            const SizedBox(height: 8),
            TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit')),
            const SizedBox(height: 8),
            TextField(controller: ppCtrl, decoration: const InputDecoration(labelText: 'Purchase Price')),
            const SizedBox(height: 8),
            TextField(controller: spCtrl, decoration: const InputDecoration(labelText: 'Sale Price')),
            const SizedBox(height: 8),
            TextField(controller: gstCtrl, decoration: const InputDecoration(labelText: 'GST Rate')),
            const SizedBox(height: 8),
            TextField(controller: lowCtrl, decoration: const InputDecoration(labelText: 'Low Stock Alert')),
            const SizedBox(height: 12),
            Obx(
              () => FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Product name is required');
                          return;
                        }
                        await controller.createProduct(
                          name: nameCtrl.text.trim(),
                          sku: skuCtrl.text.trim(),
                          hsnCode: hsnCtrl.text.trim(),
                          unit: unitCtrl.text.trim(),
                          purchasePrice: num.tryParse(ppCtrl.text.trim()) ?? 0,
                          salePrice: num.tryParse(spCtrl.text.trim()) ?? 0,
                          gstRate: num.tryParse(gstCtrl.text.trim()) ?? 0,
                          lowStockAlert: num.tryParse(lowCtrl.text.trim()) ?? 0,
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Product'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openAdjustStockSheet(BuildContext context) async {
    final productIdCtrl = TextEditingController();
    final warehouseIdCtrl = TextEditingController();
    final quantityCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    final type = 'in'.obs;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Obx(
          () => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: productIdCtrl, decoration: const InputDecoration(labelText: 'Product ID *')),
              const SizedBox(height: 8),
              TextField(controller: warehouseIdCtrl, decoration: const InputDecoration(labelText: 'Warehouse ID *')),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: type.value,
                items: const [
                  DropdownMenuItem(value: 'in', child: Text('Stock In')),
                  DropdownMenuItem(value: 'out', child: Text('Stock Out')),
                ],
                onChanged: (v) => type.value = v ?? 'in',
                decoration: const InputDecoration(labelText: 'Type'),
              ),
              const SizedBox(height: 8),
              TextField(controller: quantityCtrl, decoration: const InputDecoration(labelText: 'Quantity *')),
              const SizedBox(height: 8),
              TextField(controller: noteCtrl, decoration: const InputDecoration(labelText: 'Note')),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        final pid = int.tryParse(productIdCtrl.text.trim());
                        final wid = int.tryParse(warehouseIdCtrl.text.trim());
                        final qty = num.tryParse(quantityCtrl.text.trim());
                        if (pid == null || wid == null || qty == null || qty <= 0) {
                          Get.snackbar('Invalid input', 'Valid product, warehouse and quantity are required');
                          return;
                        }
                        await controller.adjustStock(
                          productId: pid,
                          warehouseId: wid,
                          type: type.value,
                          quantity: qty,
                          note: noteCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Adjustment'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductsTab extends StatelessWidget {
  const _ProductsTab({required this.controller});
  final InventoryController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search products...',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onChanged: (v) => controller.search.value = v,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(onPressed: controller.loadProducts, icon: const Icon(Icons.search_rounded)),
            ],
          ),
        ),
        Expanded(
          child: Obx(() {
            if (controller.products.isEmpty) return const Center(child: Text('No products found'));
            return RefreshIndicator(
              onRefresh: controller.loadProducts,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: controller.products.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = controller.products[i];
                  return Card(
                    child: ListTile(
                      title: Text(p.name),
                      subtitle: Text('${p.skuDisplay} • ${p.unit}'),
                      trailing: Text(formatCurrencyInr(p.salePrice)),
                    ),
                  );
                },
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _WarehousesTab extends StatelessWidget {
  const _WarehousesTab({required this.controller});
  final InventoryController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.warehouses.isEmpty) return const Center(child: Text('No warehouses found'));
      return RefreshIndicator(
        onRefresh: controller.loadWarehouses,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.warehouses.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final w = controller.warehouses[i];
            return Card(
              child: ListTile(
                title: Text(w.name),
                subtitle: Text(w.location),
              ),
            );
          },
        ),
      );
    });
  }
}

class _LowStockTab extends StatelessWidget {
  const _LowStockTab({required this.controller});
  final InventoryController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.lowStock.isEmpty) return const Center(child: Text('No low stock alerts'));
      return RefreshIndicator(
        onRefresh: controller.loadLowStock,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.lowStock.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final p = controller.lowStock[i];
            return Card(
              child: ListTile(
                title: Text(p.name),
                subtitle: Text('SKU ${p.skuDisplay} • Alert ${p.lowStockAlert}'),
                trailing: Text(
                  '${p.totalStock}',
                  style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w700),
                ),
              ),
            );
          },
        ),
      );
    });
  }
}

class _MovementsTab extends StatelessWidget {
  const _MovementsTab({required this.controller});
  final InventoryController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.movements.isEmpty) return const Center(child: Text('No stock movements'));
      return RefreshIndicator(
        onRefresh: controller.loadMovements,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.movements.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final m = controller.movements[i];
            final t = m.type;
            return Card(
              child: ListTile(
                title: Text(m.productName),
                subtitle: Text('${m.warehouseName} • ${formatIsoDate(m.createdAt)}'),
                trailing: Text(
                  '${t.toUpperCase()} ${m.quantity}',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: t == 'in' ? Colors.green : Colors.red,
                  ),
                ),
              ),
            );
          },
        ),
      );
    });
  }
}
