import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/utils/ui_format.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../finance/finance_controller.dart';

class AccountsGstReportView extends GetView<FinanceController> {
  const AccountsGstReportView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Obx(() {
          final f = controller.fromDate.value;
          return Text('GST report · $f');
        }),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.accountsGst),
      body: RefreshIndicator(
        onRefresh: controller.loadAll,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.loadAll,
              ),
            ),
            Obx(() {
              final t = controller.gstTotals.value;
              return Row(
                children: [
                  Expanded(
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Taxable value', style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                            Text(
                              t?.taxable != null ? formatCurrencyInr(_n(t!.taxable)) : '—',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Total GST', style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                            Text(
                              t?.totalTax != null ? formatCurrencyInr(_n(t!.totalTax)) : '—',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF185FA5)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            }),
            const SizedBox(height: 16),
            Text('TAX BREAKUP', style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 0.5)),
            Obx(() {
              final t = controller.gstTotals.value;
              return Column(
                children: [
                  _row('CGST', t?.cgst),
                  _row('SGST', t?.sgst),
                  _row('IGST', t?.igst),
                ],
              );
            }),
            const SizedBox(height: 12),
            Card(
              color: const Color(0xFFE1F5EE),
              child: const Padding(
                padding: EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Filing reminders', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF085041))),
                    SizedBox(height: 4),
                    Text('GSTR-1 · check due dates in portal', style: TextStyle(fontSize: 12, color: Color(0xFF085041))),
                    Text('GSTR-3B · check due dates in portal', style: TextStyle(fontSize: 12, color: Color(0xFF085041))),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Get.snackbar('Export', 'Export uses the web app for now.'),
              child: const Text('Export GSTR-1 (Excel)'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String k, dynamic v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(color: Color(0xFF73726C))),
          Text(v != null ? formatCurrencyInr(_n(v)) : '—', style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  static double _n(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }
}
