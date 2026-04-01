import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/finance_models.dart';
import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'finance_controller.dart';

class FinanceView extends GetView<FinanceController> {
  const FinanceView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Finance'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Summary'),
              Tab(text: 'P&L'),
              Tab(text: 'GST'),
            ],
          ),
          actions: [
            IconButton(
              onPressed: () => _openDateRangeDialog(context),
              icon: const Icon(Icons.date_range_rounded),
              tooltip: 'Date range',
            ),
            IconButton(
              onPressed: controller.loadAll,
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Refresh',
            ),
          ],
        ),
        body: Obx(() {
          if (controller.isLoading.value && controller.summary.value == null) {
            return const Center(child: CircularProgressIndicator());
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                child: Obx(
                  () => Row(
                    children: [
                      _rangeChip('From: ${controller.fromDate.value}'),
                      const SizedBox(width: 8),
                      _rangeChip('To: ${controller.toDate.value}'),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Obx(
                  () => AppErrorBanner(
                    message: controller.errorMessage.value,
                    onRetry: controller.loadAll,
                  ),
                ),
              ),
              if (controller.isLoading.value) const LinearProgressIndicator(minHeight: 2),
              Expanded(
                child: TabBarView(
                  children: [
                    _SummaryTab(controller: controller),
                    _PLTab(controller: controller),
                    _GstTab(controller: controller),
                  ],
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Future<void> _openDateRangeDialog(BuildContext context) async {
    final fromCtrl = TextEditingController(text: controller.fromDate.value);
    final toCtrl = TextEditingController(text: controller.toDate.value);
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Set Date Range'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: fromCtrl,
              readOnly: true,
              onTap: () => pickDateIntoController(context: context, controller: fromCtrl),
              decoration: const InputDecoration(
                labelText: 'From',
                suffixIcon: Icon(Icons.calendar_today_rounded),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: toCtrl,
              readOnly: true,
              onTap: () => pickDateIntoController(context: context, controller: toCtrl),
              decoration: const InputDecoration(
                labelText: 'To',
                suffixIcon: Icon(Icons.calendar_today_rounded),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await controller.setDateRange(from: fromCtrl.text.trim(), to: toCtrl.text.trim());
              if (context.mounted) Navigator.of(context).pop();
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }
}

class _SummaryTab extends StatelessWidget {
  const _SummaryTab({required this.controller});
  final FinanceController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final s = controller.summary.value ?? FinanceSummary.empty;
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _MetricTile(label: 'Revenue', value: formatCurrencyInr(s.revenue, decimals: 2)),
          _MetricTile(label: 'Expenses', value: formatCurrencyInr(s.expenses, decimals: 2)),
          _MetricTile(label: 'Net Profit', value: formatCurrencyInr(s.netProfit, decimals: 2)),
          _MetricTile(label: 'Receivable', value: formatCurrencyInr(s.receivable, decimals: 2)),
          _MetricTile(label: 'Payables', value: formatCurrencyInr(s.payables, decimals: 2)),
          _MetricTile(label: 'Overdue Invoices', value: '${s.overdueInvoices}'),
        ],
      );
    });
  }
}

class _PLTab extends StatelessWidget {
  const _PLTab({required this.controller});
  final FinanceController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.plRows.isEmpty) return const Center(child: Text('No P&L rows for selected period'));
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: controller.plRows.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final row = controller.plRows[i];
          return Card(
            child: ListTile(
              title: Text(row.name),
              subtitle: Text(row.type.toUpperCase()),
              trailing: Text(formatCurrencyInr(row.net, decimals: 2)),
            ),
          );
        },
      );
    });
  }
}

class _GstTab extends StatelessWidget {
  const _GstTab({required this.controller});
  final FinanceController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final totals = controller.gstTotals.value ?? GstTotals.empty;
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  _small('Taxable', formatCurrencyInr(totals.taxable, decimals: 2)),
                  _small('CGST', formatCurrencyInr(totals.cgst, decimals: 2)),
                  _small('SGST', formatCurrencyInr(totals.sgst, decimals: 2)),
                  _small('IGST', formatCurrencyInr(totals.igst, decimals: 2)),
                  _small('Total Tax', formatCurrencyInr(totals.totalTax, decimals: 2)),
                  _small('Invoice Total', formatCurrencyInr(totals.total, decimals: 2)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (controller.gstInvoices.isEmpty)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: Text('No GST invoices for selected period')),
            )
          else
            ...controller.gstInvoices.map((inv) => Card(
                  child: ListTile(
                    title: Text(inv.invoiceNumber),
                    subtitle: Text('${formatIsoDate(inv.invoiceDate)} • ${inv.status}'),
                    trailing: Text(formatCurrencyInr(inv.totalAmount, decimals: 2)),
                  ),
                )),
        ],
      );
    });
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(label),
        trailing: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }
}

Widget _rangeChip(String text) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(999),
      color: const Color(0xFFEEF2FF),
    ),
    child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
  );
}

Widget _small(String label, String value) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(10),
      color: const Color(0xFFF8FAFC),
    ),
    child: Text('$label: $value', style: const TextStyle(fontWeight: FontWeight.w600)),
  );
}

