import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'crm_add_lead_view.dart';
import 'crm_controller.dart';
import 'crm_lead_detail_view.dart';

class CrmView extends GetView<CrmController> {
  const CrmView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CRM Leads'),
        actions: [
          IconButton(onPressed: controller.loadInitial, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Get.to(() => const CrmAddLeadView()),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Lead'),
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: 1),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_rounded),
                    labelText: 'Search leads…',
                  ),
                  onChanged: (v) => controller.searchQuery.value = v,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => controller.applyFilters(),
                ),
                const SizedBox(height: 10),
                Text(
                  'STAGE FILTERS',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).hintColor,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.35,
                      ),
                ),
                const SizedBox(height: 8),
                Obx(() {
                  int? stageIdFor(String keyword) {
                    final k = keyword.toLowerCase();
                    for (final s in controller.stages) {
                      if (s.name.toLowerCase().contains(k)) return s.id;
                    }
                    return null;
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

                  return Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('All'),
                        selected: selected == null,
                        onSelected: (_) => setStage(null),
                      ),
                      ChoiceChip(
                        label: const Text('New'),
                        selected: selected != null && selected == newId,
                        onSelected: (v) {
                          if (v && newId != null) setStage(newId);
                        },
                      ),
                      ChoiceChip(
                        label: const Text('Proposal'),
                        selected: selected != null && selected == proposalId,
                        onSelected: (v) {
                          if (v && proposalId != null) setStage(proposalId);
                        },
                      ),
                      ChoiceChip(
                        label: const Text('Won'),
                        selected: selected != null && selected == wonId,
                        onSelected: (v) {
                          if (v && wonId != null) setStage(wonId);
                        },
                      ),
                    ],
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

    Color pillBg;
    Color pillFg;
    final s = stage.toLowerCase();
    if (s.contains('won')) {
      pillBg = const Color(0xFFEAF3DE);
      pillFg = const Color(0xFF27500A);
    } else if (s.contains('qualified')) {
      pillBg = const Color(0xFFFAEEDA);
      pillFg = const Color(0xFF633806);
    } else if (s.contains('proposal')) {
      pillBg = const Color(0xFFEEEDFE);
      pillFg = const Color(0xFF3C3489);
    } else if (s.contains('lost')) {
      pillBg = const Color(0xFFFCEBEB);
      pillFg = const Color(0xFF791F1F);
    } else {
      pillBg = const Color(0xFFEEEDFE);
      pillFg = const Color(0xFF3C3489);
    }

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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: pillBg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  stage,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: pillFg),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// (intentionally no priority chip: the showcase uses a stage pill instead)
