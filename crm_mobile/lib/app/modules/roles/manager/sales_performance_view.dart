import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import 'manager_overview_controller.dart';

/// Performance report — KPIs from API + static executive progress (showcase layout).
class SalesPerformanceView extends GetView<ManagerOverviewController> {
  const SalesPerformanceView({super.key});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final period = '${_month(now.month)} ${now.year}';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance report'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(period, style: const TextStyle(fontSize: 12, color: Color(0xFF185FA5))),
            ),
          ),
          IconButton(onPressed: controller.refreshAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.salesPerformance),
      body: RefreshIndicator(
        onRefresh: controller.refreshAll,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.refreshAll,
              ),
            ),
            Obx(
              () => GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 1.4,
                children: [
                  _statCard(context, 'Total leads', '${controller.teamLeads.value + controller.converted.value}'),
                  _statCard(context, 'Won', '${controller.converted.value}', color: const Color(0xFF27500A)),
                  _statCard(context, 'Pipeline', '${controller.teamLeads.value}'),
                  _statCard(context, 'Conv.', controller.convRate.value),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'EXECUTIVE TARGETS',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Theme.of(context).hintColor,
                  ),
            ),
            const SizedBox(height: 8),
            _bar(context, 'Team avg', 0.62, const Color(0xFF185FA5)),
            _bar(context, 'Conversion', _parsePct(controller.convRate.value), const Color(0xFF1D9E75)),
            const SizedBox(height: 12),
            Text(
              'LEAD SOURCES (sample)',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Theme.of(context).hintColor,
                  ),
            ),
            const SizedBox(height: 8),
            _sourceRow(context, 'Active pipeline', '${controller.teamLeads.value} leads'),
            _sourceRow(context, 'Won deals', '${controller.converted.value} closed'),
          ],
        ),
      ),
    );
  }

  Widget _statCard(BuildContext context, String k, String v, {Color? color}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(k, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
            const Spacer(),
            Text(
              v,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bar(BuildContext context, String label, double pct, Color fill) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 11)),
              Text('${(pct * 100).round()}%', style: TextStyle(fontSize: 11, color: fill)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct.clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: Theme.of(context).dividerColor,
              color: fill,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sourceRow(BuildContext context, String name, String right) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Container(width: 8, height: 8, color: const Color(0xFF185FA5)),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      trailing: Text(right, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }

  static String _month(int m) {
    const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[m];
  }

  static double _parsePct(String s) {
    final n = double.tryParse(s.replaceAll('%', '').trim());
    if (n == null) return 0.35;
    return (n / 100).clamp(0.0, 1.0);
  }
}
