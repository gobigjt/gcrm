import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../shared/widgets/app_error_banner.dart';
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
        onPressed: () => _openCreateLeadSheet(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Lead'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Obx(
              () => Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int?>(
                      value: controller.selectedStageId.value,
                      items: [
                        const DropdownMenuItem<int?>(value: null, child: Text('All Stages')),
                        ...controller.stages.map(
                          (s) => DropdownMenuItem<int?>(
                            value: s.id,
                            child: Text(s.name.isEmpty ? 'Stage' : s.name),
                          ),
                        ),
                      ],
                      onChanged: (v) => controller.selectedStageId.value = v,
                      decoration: const InputDecoration(labelText: 'Stage'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<int?>(
                      value: controller.selectedSourceId.value,
                      items: [
                        const DropdownMenuItem<int?>(value: null, child: Text('All Sources')),
                        ...controller.sources.map(
                          (s) => DropdownMenuItem<int?>(
                            value: s.id,
                            child: Text(s.name.isEmpty ? 'Source' : s.name),
                          ),
                        ),
                      ],
                      onChanged: (v) => controller.selectedSourceId.value = v,
                      decoration: const InputDecoration(labelText: 'Source'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: controller.applyFilters,
                    icon: const Icon(Icons.filter_alt_rounded),
                    tooltip: 'Apply filters',
                  ),
                ],
              ),
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
                  itemBuilder: (_, i) => _LeadCard(
                    lead: controller.leads[i],
                    onTap: () async {
                      final id = controller.leads[i].id;
                      await Get.to(() => CrmLeadDetailView(leadId: id));
                      await controller.applyFilters();
                    },
                  ),
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemCount: controller.leads.length,
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Future<void> _openCreateLeadSheet(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final companyCtrl = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Create Lead', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
              const SizedBox(height: 10),
              TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: 10),
              TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
              const SizedBox(height: 10),
              TextField(controller: companyCtrl, decoration: const InputDecoration(labelText: 'Company')),
              const SizedBox(height: 14),
              Obx(
                () => FilledButton(
                  onPressed: controller.isSubmitting.value
                      ? null
                      : () async {
                          if (nameCtrl.text.trim().isEmpty) {
                            Get.snackbar('Missing data', 'Lead name is required');
                            return;
                          }
                          await controller.createLead(
                            name: nameCtrl.text.trim(),
                            email: emailCtrl.text.trim(),
                            phone: phoneCtrl.text.trim(),
                            company: companyCtrl.text.trim(),
                          );
                          if (context.mounted) Navigator.of(context).pop();
                        },
                  child: controller.isSubmitting.value
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save Lead'),
                ),
              ),
            ],
          ),
        );
      },
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
    final priority = lead.priority;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      lead.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  _PriorityChip(priority: priority),
                ],
              ),
              const SizedBox(height: 6),
              Text(lead.company),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Chip(label: Text('Stage: $stage')),
                  Chip(label: Text('Source: $source')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PriorityChip extends StatelessWidget {
  const _PriorityChip({required this.priority});

  final String priority;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (priority) {
      case 'hot':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFB91C1C);
        break;
      case 'cold':
        bg = const Color(0xFFE0E7FF);
        fg = const Color(0xFF3730A3);
        break;
      default:
        bg = const Color(0xFFFFF7ED);
        fg = const Color(0xFF9A3412);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(priority.toUpperCase(), style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 11)),
    );
  }
}
