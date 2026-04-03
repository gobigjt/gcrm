import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import '../../showcase/showcase_widgets.dart';
import 'crm_add_lead_view.dart';
import 'crm_controller.dart';
import 'crm_lead_detail_view.dart';

class CrmView extends GetView<CrmController> {
  const CrmView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Obx(() => Text('My leads (${controller.leads.length})')),
        actions: [
          IconButton(
            onPressed: controller.loadInitial,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: '',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Get.to(() => const CrmAddLeadView()),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Lead'),
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.crm),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_rounded),
                    hintText: 'Search leads…',
                    isDense: true,
                  ),
                  onChanged: (v) => controller.searchQuery.value = v,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => controller.applyFilters(),
                ),
                const SizedBox(height: 10),
                const ShowcaseSectionTitle('Stage filters'),
                Obx(() {
                  int? stageIdFor(String keyword) {
                    final k = keyword.toLowerCase();
                    for (final s in controller.stages) {
                      if (s.name.toLowerCase().contains(k)) return s.id;
                    }
                    return null;
                  }

                  int countMatching(bool Function(String st) pred) {
                    return controller.leadsAll.where((l) => pred(l.stage.toLowerCase())).length;
                  }

                  final newId = stageIdFor('new');
                  final proposalId = stageIdFor('proposal');
                  final wonId = stageIdFor('won');
                  final selected = controller.selectedStageId.value;

                  void setStage(int? id) {
                    controller.selectedStageId.value = id;
                    controller.selectedSourceId.value = null;
                    controller.applyFilters();
                  }

                  final allN = controller.leadsAll.length;
                  final newN = countMatching((s) => s.contains('new'));
                  final propN = countMatching((s) => s.contains('proposal'));
                  final wonN = countMatching((s) => s.contains('won'));

                  return SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _StagePillChip(
                          label: 'All ($allN)',
                          selected: selected == null,
                          onTap: () => setStage(null),
                        ),
                        const SizedBox(width: 8),
                        _StagePillChip(
                          label: 'New ($newN)',
                          selected: selected != null && selected == newId,
                          onTap: () {
                            if (newId != null) setStage(newId);
                          },
                        ),
                        const SizedBox(width: 8),
                        _StagePillChip(
                          label: 'Proposal ($propN)',
                          selected: selected != null && selected == proposalId,
                          onTap: () {
                            if (proposalId != null) setStage(proposalId);
                          },
                        ),
                        const SizedBox(width: 8),
                        _StagePillChip(
                          label: 'Won ($wonN)',
                          selected: selected != null && selected == wonId,
                          onTap: () {
                            if (wonId != null) setStage(wonId);
                          },
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: () {
                  if (controller.selectedStageId.value != null || controller.selectedSourceId.value != null) {
                    controller.applyFilters();
                  } else {
                    controller.loadInitial();
                  }
                },
              ),
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) {
                return const Center(child: CircularProgressIndicator());
              }
              if (controller.leads.isEmpty) {
                return const Center(child: Text('No leads found'));
              }

              return RefreshIndicator(
                onRefresh: controller.applyFilters,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: controller.leads.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final lead = controller.leads[i];
                    return _LeadCard(
                      lead: lead,
                      onTap: () async {
                        await Get.to(() => CrmLeadDetailView(leadId: lead.id));
                        await controller.applyFilters();
                      },
                    );
                  },
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

}

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead, required this.onTap});

  final CrmLead lead;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final stage = lead.stage;
    final source = lead.source;
    final value = (lead.leadScore * 1000).toInt();

    final initialsSource = (lead.company.isNotEmpty ? lead.company : lead.name).trim();
    final parts = initialsSource.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials =
        parts.isEmpty ? '?' : (parts.length == 1 ? parts.first.substring(0, parts.first.length.clamp(0, 2)) : (parts[0][0] + parts[1][0])).toUpperCase();

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: const Color(0xFFE6F1FB),
                child: Text(
                  initials,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0C447C)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lead.company.isNotEmpty ? lead.company : lead.name,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$source · ${formatCurrencyInr(value)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                    ),
                  ],
                ),
              ),
              ShowcaseStagePill(stage),
            ],
          ),
        ),
      ),
    );
  }
}

// (intentionally no priority chip: the showcase uses a stage pill instead)

class _StagePillChip extends StatelessWidget {
  const _StagePillChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const selectedBg = Color(0xFFE6F1FB);
    const selectedFg = Color(0xFF0C447C);
    const selectedBorder = Color(0xFF185FA5);
    final unselectedBg = scheme.surfaceContainerHighest;
    final unselectedFg = scheme.onSurfaceVariant;
    final unselectedBorder = scheme.outline.withValues(alpha: 0.45);

    return Material(
      color: selected ? selectedBg : unselectedBg,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? selectedBorder : unselectedBorder,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? selectedFg : unselectedFg,
            ),
          ),
        ),
      ),
    );
  }
}
