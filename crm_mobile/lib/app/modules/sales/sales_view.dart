import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'sales_controller.dart';

class SalesView extends GetView<SalesController> {
  const SalesView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Sales'),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            tabs: const [
              Tab(text: 'Customers'),
              Tab(text: 'Quotations'),
              Tab(text: 'Orders'),
            ],
          ),
        ),
        floatingActionButton: Obx(
          () => controller.selectedTab.value == 0
              ? FloatingActionButton.extended(
                  onPressed: () => _openCreateCustomerSheet(context),
                  icon: const Icon(Icons.person_add_alt_1_rounded),
                  label: const Text('New Customer'),
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
                    _CustomersTab(controller: controller),
                    _QuotationsTab(controller: controller),
                    _OrdersTab(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openCreateCustomerSheet(BuildContext context) async {
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
            Text('Create Customer', style: Theme.of(context).textTheme.titleLarge),
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
                          Get.snackbar('Missing data', 'Customer name is required');
                          return;
                        }
                        await controller.createCustomer(
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
                    : const Text('Save Customer'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CustomersTab extends StatelessWidget {
  const _CustomersTab({required this.controller});
  final SalesController controller;

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
                    hintText: 'Search customers...',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onChanged: (v) => controller.search.value = v,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: controller.loadCustomers,
                icon: const Icon(Icons.search_rounded),
                tooltip: 'Search',
              ),
            ],
          ),
        ),
        Expanded(
          child: Obx(() {
            if (controller.customers.isEmpty) {
              return const Center(child: Text('No customers found'));
            }
            return RefreshIndicator(
              onRefresh: controller.loadCustomers,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: controller.customers.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final c = controller.customers[i];
                  return Card(
                    child: ListTile(
                      title: Text(c.name),
                      subtitle: Text('${c.email} • ${c.phone}'),
                      trailing: Text(c.hasGstin ? 'GST' : '—'),
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

class _QuotationsTab extends StatelessWidget {
  const _QuotationsTab({required this.controller});
  final SalesController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.quotations.isEmpty) {
        return const Center(child: Text('No quotations found'));
      }
      return RefreshIndicator(
        onRefresh: controller.loadQuotations,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.quotations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final q = controller.quotations[i];
            return Card(
              child: ListTile(
                title: Text(q.quotationNumber),
                subtitle: Text(q.customerName),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(q.status),
                    Text(formatCurrencyInr(q.totalAmount)),
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

class _OrdersTab extends StatelessWidget {
  const _OrdersTab({required this.controller});
  final SalesController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.orders.isEmpty) {
        return const Center(child: Text('No orders found'));
      }
      return RefreshIndicator(
        onRefresh: controller.loadOrders,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.orders.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final o = controller.orders[i];
            return Card(
              child: ListTile(
                title: Text(o.orderNumber),
                subtitle: Text(o.customerName),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(o.status),
                    Text(formatCurrencyInr(o.totalAmount)),
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
