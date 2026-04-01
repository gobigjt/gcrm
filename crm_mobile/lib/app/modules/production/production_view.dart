import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'production_controller.dart';

class ProductionView extends GetView<ProductionController> {
  const ProductionView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Production'),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            tabs: const [Tab(text: 'BOMs'), Tab(text: 'Work Orders')],
          ),
        ),
        floatingActionButton: Obx(() {
          if (controller.selectedTab.value == 0) {
            return FloatingActionButton.extended(
              onPressed: () => _openCreateBomSheet(context),
              icon: const Icon(Icons.list_alt_rounded),
              label: const Text('New BOM'),
            );
          }
          return FloatingActionButton.extended(
            onPressed: () => _openCreateWorkOrderSheet(context),
            icon: const Icon(Icons.precision_manufacturing_rounded),
            label: const Text('New Work Order'),
          );
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
                    _BomsTab(controller: controller),
                    _WorkOrdersTab(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openCreateBomSheet(BuildContext context) async {
    final productIdCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final versionCtrl = TextEditingController(text: '1.0');

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
            TextField(controller: productIdCtrl, decoration: const InputDecoration(labelText: 'Product ID *')),
            const SizedBox(height: 8),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'BOM Name *')),
            const SizedBox(height: 8),
            TextField(controller: versionCtrl, decoration: const InputDecoration(labelText: 'Version')),
            const SizedBox(height: 12),
            Obx(
              () => FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        final pid = int.tryParse(productIdCtrl.text.trim());
                        if (pid == null || nameCtrl.text.trim().isEmpty) {
                          Get.snackbar('Invalid input', 'Product ID and BOM name are required');
                          return;
                        }
                        await controller.createBom(
                          productId: pid,
                          name: nameCtrl.text.trim(),
                          version: versionCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save BOM'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openCreateWorkOrderSheet(BuildContext context) async {
    final productIdCtrl = TextEditingController();
    final bomIdCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final startCtrl = TextEditingController(text: toYmd(DateTime.now()));
    final endCtrl = TextEditingController();
    final notesCtrl = TextEditingController();

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
            TextField(controller: productIdCtrl, decoration: const InputDecoration(labelText: 'Product ID *')),
            const SizedBox(height: 8),
            TextField(controller: bomIdCtrl, decoration: const InputDecoration(labelText: 'BOM ID')),
            const SizedBox(height: 8),
            TextField(controller: qtyCtrl, decoration: const InputDecoration(labelText: 'Quantity *')),
            const SizedBox(height: 8),
            TextField(
              controller: startCtrl,
              readOnly: true,
              onTap: () => pickDateIntoController(context: context, controller: startCtrl),
              decoration: const InputDecoration(labelText: 'Planned Start', suffixIcon: Icon(Icons.calendar_today_rounded)),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: endCtrl,
              readOnly: true,
              onTap: () => pickDateIntoController(context: context, controller: endCtrl),
              decoration: const InputDecoration(labelText: 'Planned End', suffixIcon: Icon(Icons.calendar_today_rounded)),
            ),
            const SizedBox(height: 8),
            TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes')),
            const SizedBox(height: 12),
            Obx(
              () => FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        final pid = int.tryParse(productIdCtrl.text.trim());
                        final bid = int.tryParse(bomIdCtrl.text.trim());
                        final qty = num.tryParse(qtyCtrl.text.trim());
                        if (pid == null || qty == null || qty <= 0) {
                          Get.snackbar('Invalid input', 'Valid product ID and quantity are required');
                          return;
                        }
                        await controller.createWorkOrder(
                          productId: pid,
                          bomId: bid,
                          quantity: qty,
                          plannedStart: startCtrl.text.trim().isEmpty ? null : startCtrl.text.trim(),
                          plannedEnd: endCtrl.text.trim().isEmpty ? null : endCtrl.text.trim(),
                          notes: notesCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Work Order'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BomsTab extends StatelessWidget {
  const _BomsTab({required this.controller});
  final ProductionController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.boms.isEmpty) return const Center(child: Text('No BOMs found'));
      return RefreshIndicator(
        onRefresh: controller.loadBoms,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.boms.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final b = controller.boms[i];
            return Card(
              child: ListTile(
                title: Text(b.name),
                subtitle: Text('${b.productName} • v${b.version}'),
              ),
            );
          },
        ),
      );
    });
  }
}

class _WorkOrdersTab extends StatelessWidget {
  const _WorkOrdersTab({required this.controller});
  final ProductionController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: controller.workOrderStatusFilter.value.isEmpty ? null : controller.workOrderStatusFilter.value,
                  items: const [
                    DropdownMenuItem(value: 'planned', child: Text('Planned')),
                    DropdownMenuItem(value: 'in_progress', child: Text('In Progress')),
                    DropdownMenuItem(value: 'completed', child: Text('Completed')),
                    DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                  ],
                  onChanged: (v) => controller.workOrderStatusFilter.value = v ?? '',
                  decoration: const InputDecoration(labelText: 'Status filter'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: controller.loadWorkOrders,
                icon: const Icon(Icons.filter_alt_rounded),
                tooltip: 'Apply filter',
              ),
            ],
          ),
        ),
        Expanded(
          child: Obx(() {
            if (controller.workOrders.isEmpty) return const Center(child: Text('No work orders found'));
            return RefreshIndicator(
              onRefresh: controller.loadWorkOrders,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: controller.workOrders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final w = controller.workOrders[i];
                  final status = w.status;
                  return Card(
                    child: ListTile(
                      title: Text(w.woNumber),
                      subtitle: Text('${w.productName} • Qty ${w.quantity}'),
                      trailing: PopupMenuButton<String>(
                        onSelected: (value) => controller.updateWorkOrderStatus(workOrderId: w.id, status: value),
                        itemBuilder: (_) => const [
                          PopupMenuItem(value: 'planned', child: Text('Set Planned')),
                          PopupMenuItem(value: 'in_progress', child: Text('Set In Progress')),
                          PopupMenuItem(value: 'completed', child: Text('Set Completed')),
                          PopupMenuItem(value: 'cancelled', child: Text('Set Cancelled')),
                        ],
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: _statusBg(status),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(status.toUpperCase(), style: TextStyle(color: _statusFg(status), fontSize: 11, fontWeight: FontWeight.w700)),
                        ),
                      ),
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

Color _statusBg(String status) {
  switch (status) {
    case 'in_progress':
      return const Color(0xFFFEF3C7);
    case 'completed':
      return const Color(0xFFDCFCE7);
    case 'cancelled':
      return const Color(0xFFFEE2E2);
    default:
      return const Color(0xFFE2E8F0);
  }
}

Color _statusFg(String status) {
  switch (status) {
    case 'in_progress':
      return const Color(0xFF92400E);
    case 'completed':
      return const Color(0xFF166534);
    case 'cancelled':
      return const Color(0xFFB91C1C);
    default:
      return const Color(0xFF334155);
  }
}
