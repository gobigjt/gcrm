import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../auth/auth_controller.dart';
import '../../../showcase/showcase_colors.dart';
import '../../../showcase/showcase_widgets.dart';

/// Subscription & usage (showcase wireframe).
class SubscriptionView extends StatelessWidget {
  const SubscriptionView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: Get.back),
        title: const Text('Subscription'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Current plan', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  const Text('Premium', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  Obx(
                    () => Text(
                      'Billed for ${auth.userName.value}\'s organization',
                      style: TextStyle(color: Theme.of(context).hintColor, fontSize: 13),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '₹3,999 / month',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: ShowcaseColors.accent),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Renews on the 1st · Manage billing in the web admin when connected.',
                    style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const ShowcaseSectionTitle('Usage this period'),
          const SizedBox(height: 4),
          _UsageBar(label: 'Users', value: 0.62),
          _UsageBar(label: 'Storage', value: 0.35),
          _UsageBar(label: 'API calls', value: 0.48),
          const SizedBox(height: 20),
          const ShowcaseSectionTitle('Payment history'),
          const SizedBox(height: 4),
          _historyRow(context, '1 Mar 2026', 'Premium', '₹3,999', 'Paid'),
          _historyRow(context, '1 Feb 2026', 'Premium', '₹3,999', 'Paid'),
          _historyRow(context, '1 Jan 2026', 'Premium', '₹3,999', 'Paid'),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => Get.snackbar('Upgrade', 'Billing portal integration pending.'),
            child: const Text('Change plan'),
          ),
        ],
      ),
    );
  }

  static Widget _historyRow(BuildContext context, String date, String plan, String amt, String status) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(date, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text('$plan · $amt', style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ShowcaseColors.greenSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              'Paid',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: ShowcaseColors.greenText),
            ),
          ),
        ],
      ),
    );
  }
}

class _UsageBar extends StatelessWidget {
  const _UsageBar({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              Text('${(value * 100).round()}%', style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: value,
              minHeight: 8,
              backgroundColor: Colors.black.withValues(alpha: 0.06),
              color: ShowcaseColors.accent,
            ),
          ),
        ],
      ),
    );
  }
}
