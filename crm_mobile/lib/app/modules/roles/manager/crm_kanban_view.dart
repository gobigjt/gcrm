import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/models/crm_models.dart';
import '../../../core/utils/ui_format.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../crm/crm_controller.dart';
import '../../crm/crm_lead_detail_view.dart';

/// Lead kanban — columns from CRM stages, cards from [CrmController].leads.
class CrmKanbanView extends GetView<CrmController> {
  const CrmKanbanView({super.key});

  static const List<Color> _colHeaderColors = [
    Color(0xFFE6F1FB),
    Color(0xFFE1F5EE),
    Color(0xFFEEEDFE),
    Color(0xFFEAF3DE),
  ];

  static const List<Color> _colHeaderFg = [
    Color(0xFF0C447C),
    Color(0xFF085041),
    Color(0xFF3C3489),
    Color(0xFF27500A),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lead kanban'),
        actions: [
          IconButton(onPressed: controller.loadInitial, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.crmKanban),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.loadInitial,
              ),
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value && controller.leads.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              final stages = controller.stages.toList()..sort((a, b) => a.id.compareTo(b.id));
              if (stages.isEmpty) {
                return const Center(child: Text('No stages — check CRM setup.'));
              }
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                itemCount: stages.length,
                itemBuilder: (ctx, i) {
                  final st = stages[i];
                  final inStage = controller.leads.where((l) => l.stage == st.name).toList();
                  final hi = i % _colHeaderColors.length;
                  return SizedBox(
                    width: 148,
                    child: Card(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: BoxDecoration(
                              color: _colHeaderColors[hi],
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                            ),
                            child: Text(
                              '${st.name} · ${inStage.length}',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: _colHeaderFg[hi],
                              ),
                            ),
                          ),
                          Expanded(
                            child: ListView.builder(
                              padding: const EdgeInsets.all(6),
                              itemCount: inStage.length,
                              itemBuilder: (_, j) => _KanbanCard(lead: inStage[j]),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _KanbanCard extends StatelessWidget {
  const _KanbanCard({required this.lead});

  final CrmLead lead;

  @override
  Widget build(BuildContext context) {
    final border = switch (lead.stage.toLowerCase()) {
      String s when s.contains('new') => const Color(0xFF378ADD),
      String s when s.contains('contact') || s.contains('cont') => const Color(0xFF1D9E75),
      String s when s.contains('prop') => const Color(0xFF7F77DD),
      String s when s.contains('won') => const Color(0xFF639922),
      _ => const Color(0xFF185FA5),
    };
    final title = lead.company.isNotEmpty ? lead.company : lead.name;
    final val = lead.leadScore > 0 ? formatCurrencyInr(lead.leadScore * 1000) : '—';
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: () => Get.to(() => CrmLeadDetailView(leadId: lead.id)),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border(left: BorderSide(color: border, width: 3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                const SizedBox(height: 2),
                Text(
                  '$val · ${lead.source}',
                  style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
