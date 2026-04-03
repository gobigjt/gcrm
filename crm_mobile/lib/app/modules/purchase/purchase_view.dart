import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'purchase_controller.dart';

class PurchaseView extends GetView<PurchaseController> {
  const PurchaseView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Purchase'),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            tabs: const [
              Tab(text: 'Vendors'),
              Tab(text: 'POs'),
              Tab(text: 'GRNs'),
            ],
          ),
        ),
        floatingActionButton: Obx(
          () => controller.selectedTab.value == 0
              ? FloatingActionButton.extended(
                  onPressed: () => _openCreateVendorSheet(context),
                  icon: const Icon(Icons.store_mall_directory_rounded),
                  label: const Text('New Vendor'),
                )
              : const SizedBox.shrink(),
        ),
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
                    _VendorsTab(controller: controller),
                    _POsTab(controller: controller),
                    _GRNsTab(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
        bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.purchase),
      ),
    );
  }

  Future<void> _openCreateVendorSheet(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final gstinCtrl = TextEditingController();
    final addrCtrl = TextEditingController();

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
            Text('Create Vendor', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
            const SizedBox(height: 8),
            TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 8),
            TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 8),
            TextField(controller: gstinCtrl, decoration: const InputDecoration(labelText: 'GSTIN')),
            const SizedBox(height: 8),
            TextField(controller: addrCtrl, decoration: const InputDecoration(labelText: 'Address')),
            const SizedBox(height: 12),
            Obx(
              () => FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Vendor name is required');
                          return;
                        }
                        await controller.createVendor(
                          name: nameCtrl.text.trim(),
                          email: emailCtrl.text.trim(),
                          phone: phoneCtrl.text.trim(),
                          gstin: gstinCtrl.text.trim(),
                          address: addrCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Vendor'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VendorsTab extends StatelessWidget {
  const _VendorsTab({required this.controller});
  final PurchaseController controller;

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
                    hintText: 'Search vendors...',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onChanged: (v) => controller.search.value = v,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(onPressed: controller.loadVendors, icon: const Icon(Icons.search_rounded)),
            ],
          ),
        ),
        Expanded(
          child: Obx(() {
            if (controller.vendors.isEmpty) return const Center(child: Text('No vendors found'));
            return RefreshIndicator(
              onRefresh: controller.loadVendors,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: controller.vendors.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final v = controller.vendors[i];
                  return Card(
                    child: ListTile(
                      title: Text(v.name),
                      subtitle: Text('${v.email} • ${v.phone}'),
                      trailing: Text(v.hasGstin ? 'GST' : '—'),
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

class _POsTab extends StatelessWidget {
  const _POsTab({required this.controller});
  final PurchaseController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.pos.isEmpty) return const Center(child: Text('No purchase orders found'));
      return RefreshIndicator(
        onRefresh: controller.loadPOs,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.pos.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final po = controller.pos[i];
            return Card(
              child: ListTile(
                title: Text(po.poNumber),
                subtitle: Text(po.vendorName),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(po.status),
                    Text(formatCurrencyInr(po.totalAmount)),
                  ],
                ),
              ),
            );
          },
        ),
      );
    });
  }
}

class _GRNsTab extends StatelessWidget {
  const _GRNsTab({required this.controller});
  final PurchaseController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.grns.isEmpty) return const Center(child: Text('No GRNs found'));
      return RefreshIndicator(
        onRefresh: controller.loadGRNs,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.grns.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final grn = controller.grns[i];
            return Card(
              child: ListTile(
                title: Text(grn.grnNumber),
                subtitle: Text('${grn.vendorName} • PO ${grn.poNumber}'),
                trailing: Text(formatIsoDate(grn.receivedAt)),
              ),
            );
          },
        ),
      );
    });
  }
}
