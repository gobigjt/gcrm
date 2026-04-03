import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/utils/ui_format.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../../showcase/showcase_widgets.dart';
import '../../finance/finance_controller.dart';
import 'invoice_detail_view.dart';

class AccountsInvoicesView extends GetView<FinanceController> {
  const AccountsInvoicesView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoices'),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.accountsInvoices),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search invoices…',
                isDense: true,
              ),
              onChanged: (v) {
                controller.errorMessage.value = '';
                controller.invoiceSearchQuery.value = v;
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.loadAll,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Obx(() {
              void setF(String v) => controller.invoiceListFilter.value = v;
              final f = controller.invoiceListFilter.value;
              final all = controller.gstInvoices;
              int paidN = 0;
              int odN = 0;
              for (final inv in all) {
                final st = inv.status.toLowerCase();
                if (st.contains('paid')) paidN++;
                if (st.contains('overdue') || st.contains('pending')) odN++;
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const ShowcaseSectionTitle('Status'),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _InvFilterChip(
                          label: 'All (${all.length})',
                          selected: f == 'all',
                          onTap: () => setF('all'),
                        ),
                        const SizedBox(width: 8),
                        _InvFilterChip(
                          label: 'Paid ($paidN)',
                          selected: f == 'paid',
                          onTap: () => setF('paid'),
                        ),
                        const SizedBox(width: 8),
                        _InvFilterChip(
                          label: 'Overdue ($odN)',
                          selected: f == 'overdue',
                          onTap: () => setF('overdue'),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value && controller.gstInvoices.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              final raw = controller.gstInvoices;
              final f = controller.invoiceListFilter.value;
              final q = controller.invoiceSearchQuery.value.trim().toLowerCase();
              final list = raw.where((inv) {
                final st = inv.status.toLowerCase();
                if (f == 'paid') {
                  if (!st.contains('paid')) return false;
                } else if (f == 'overdue') {
                  if (!(st.contains('overdue') || st.contains('pending'))) return false;
                }
                if (q.isEmpty) return true;
                final num = inv.invoiceNumber.toLowerCase();
                final dateStr = inv.invoiceDate.toString().toLowerCase();
                return num.contains(q) || st.contains(q) || dateStr.contains(q);
              }).toList();
              if (list.isEmpty) {
                return const Center(child: Text('No invoices for the selected date range.'));
              }
              return ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final inv = list[i];
                  final st = inv.status.toLowerCase();
                  final overdue = st.contains('overdue') || st.contains('pending');
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(vertical: 4),
                    title: Text(
                      inv.invoiceNumber,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                    subtitle: Text('${inv.invoiceDate} · ${inv.status}', style: const TextStyle(fontSize: 11)),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          formatCurrencyInr(_num(inv.totalAmount)),
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: overdue ? const Color(0xFFFCEBEB) : const Color(0xFFEAF3DE),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            inv.status,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: overdue ? const Color(0xFF791F1F) : const Color(0xFF27500A),
                            ),
                          ),
                        ),
                      ],
                    ),
                    onTap: () => Get.to(() => InvoiceDetailView(invoice: inv)),
                  );
                },
              );
            }),
          ),
        ],
      ),
    );
  }

  static double _num(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }
}

class _InvFilterChip extends StatelessWidget {
  const _InvFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFFAEEDA) : Colors.white,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? const Color(0xFF633806) : Colors.black.withValues(alpha: 0.08),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? const Color(0xFF633806) : Theme.of(context).hintColor,
            ),
          ),
        ),
      ),
    );
  }
}
