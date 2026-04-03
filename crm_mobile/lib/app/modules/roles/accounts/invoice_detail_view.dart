import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/models/finance_models.dart';
import '../../../core/utils/ui_format.dart';

class InvoiceDetailView extends StatelessWidget {
  const InvoiceDetailView({super.key, required this.invoice});

  final GstInvoiceRow invoice;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: Get.back),
        title: Text(invoice.invoiceNumber),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Invoice',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFCEBEB),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          invoice.status,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF791F1F)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Date: ${invoice.invoiceDate}', style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
                  const Divider(height: 20),
                  Text(
                    'Total ${formatCurrencyInr(_num(invoice.totalAmount))}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF185FA5)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () => Get.snackbar('Payment', 'Record payment is not wired in this build.'),
                  child: const Text('Record payment'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Get.snackbar('PDF', 'Download PDF is not wired in this build.'),
                  child: const Text('Download PDF'),
                ),
              ),
            ],
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
