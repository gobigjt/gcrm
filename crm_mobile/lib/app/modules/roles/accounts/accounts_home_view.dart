import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/utils/ui_format.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../../showcase/showcase_widgets.dart';
import '../../auth/auth_controller.dart';
import '../../finance/finance_controller.dart';

/// Accounts persona — finance overview (showcase "Finance overview").
class AccountsHomeView extends GetView<FinanceController> {
  const AccountsHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finance overview'),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.accountsHome),
      body: RefreshIndicator(
        onRefresh: controller.loadAll,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: const Color(0xFFFAEEDA),
                foregroundColor: const Color(0xFF633806),
                child: Text(
                  auth.userName.value.isNotEmpty ? auth.userName.value.substring(0, 1).toUpperCase() : '?',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              title: Text(auth.userName.value, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Accounts'),
            ),
            const SizedBox(height: 8),
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.loadAll,
              ),
            ),
            Obx(() => controller.isLoading.value ? const LinearProgressIndicator(minHeight: 2) : const SizedBox.shrink()),
            Obx(() {
              final s = controller.summary.value;
              final recv = s?.receivable;
              final coll = s?.revenue;
              final overdueN = s?.overdueInvoices ?? 0;
              return GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 1.35,
                children: [
                  _tile(context, 'Receivables', recv != null ? formatCurrencyInr(_num(recv)) : '—', '$overdueN pending'),
                  _tile(context, 'Collected', coll != null ? formatCurrencyInr(_num(coll)) : '—', 'MTD'),
                  _tile(context, 'GST total', controller.gstTotals.value?.total != null
                      ? formatCurrencyInr(_num(controller.gstTotals.value!.total))
                      : '—', 'Selected range'),
                  _tile(context, 'Overdue inv.', overdueN > 0 ? '$overdueN' : '0', 'Follow up', valueColor: const Color(0xFFE24B4A)),
                ],
              );
            }),
            const SizedBox(height: 14),
            const ShowcaseSectionTitle('Aging buckets'),
            Obx(() {
              final s = controller.summary.value;
              final overdueN = s?.overdueInvoices ?? 0;
              return ShowcaseKpiGrid(
                cells: [
                  const ShowcaseKpiCell(label: '0–30 days', value: '—', hint: 'Current'),
                  const ShowcaseKpiCell(label: '31–60 days', value: '—', hint: 'Watch'),
                  const ShowcaseKpiCell(label: '61–90 days', value: '—', hint: 'Escalate'),
                  ShowcaseKpiCell(
                    label: '90+ days',
                    value: '$overdueN',
                    hint: 'Invoices',
                    valueColor: overdueN > 0 ? const Color(0xFFE24B4A) : null,
                  ),
                ],
              );
            }),
            const SizedBox(height: 14),
            Text(
              'GST INVOICES (preview)',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Theme.of(context).hintColor,
                  ),
            ),
            const SizedBox(height: 8),
            Obx(() {
              final rows = controller.gstInvoices.take(4);
              if (rows.isEmpty) {
                return Text('No invoices in range.', style: TextStyle(color: Theme.of(context).hintColor));
              }
              return Column(
                children: rows.map((inv) {
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.receipt_long_rounded, size: 20),
                    title: Text(inv.invoiceNumber, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    subtitle: Text('${inv.status} · ${inv.invoiceDate}', style: const TextStyle(fontSize: 11)),
                    trailing: Text(
                      formatCurrencyInr(_num(inv.totalAmount)),
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                    ),
                  );
                }).toList(),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, String k, String v, String sub, {Color? valueColor}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(k, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
            const Spacer(),
            Text(v, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: valueColor)),
            Text(sub, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
          ],
        ),
      ),
    );
  }

  static double _num(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }
}
