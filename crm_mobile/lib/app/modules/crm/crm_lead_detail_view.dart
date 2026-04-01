import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'crm_lead_detail_controller.dart';

class CrmLeadDetailView extends StatelessWidget {
  const CrmLeadDetailView({super.key, required this.leadId});

  final int leadId;

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(CrmLeadDetailController(leadId: leadId), tag: 'lead-$leadId');
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Lead Details'),
          actions: [
            IconButton(onPressed: controller.load, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Activities'), Tab(text: 'Follow-ups')]),
        ),
        body: Obx(() {
          if (controller.isLoading.value && controller.lead.value == null) {
            return const Center(child: CircularProgressIndicator());
          }
          final lead = controller.lead.value ?? CrmLead.placeholder;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Obx(
                  () => AppErrorBanner(
                    message: controller.errorMessage.value,
                    onRetry: controller.load,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lead.name,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        Text(lead.company),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            Chip(label: Text('Stage: ${lead.stage}')),
                            Chip(label: Text('Source: ${lead.source}')),
                            Chip(label: Text('Priority: ${lead.priority}')),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _ActivitiesTab(controller: controller),
                    _FollowupsTab(controller: controller),
                  ],
                ),
              ),
            ],
          );
        }),
        floatingActionButton: Obx(() {
          final idx = DefaultTabController.of(context).index;
          return FloatingActionButton.extended(
            onPressed: controller.isSubmitting.value
                ? null
                : () => idx == 0 ? _openAddActivity(context, controller) : _openAddFollowup(context, controller),
            icon: const Icon(Icons.add_rounded),
            label: Text(idx == 0 ? 'Add Activity' : 'Add Follow-up'),
          );
        }),
      ),
    );
  }

  Future<void> _openAddActivity(BuildContext context, CrmLeadDetailController controller) async {
    final typeCtrl = TextEditingController(text: 'note');
    final descCtrl = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: typeCtrl, decoration: const InputDecoration(labelText: 'Type (call, note, email)')),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                if (descCtrl.text.trim().isEmpty) return;
                await controller.addActivity(type: typeCtrl.text.trim(), description: descCtrl.text.trim());
                if (context.mounted) Navigator.of(context).pop();
              },
              child: const Text('Save Activity'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openAddFollowup(BuildContext context, CrmLeadDetailController controller) async {
    final dateCtrl = TextEditingController(text: DateTime.now().toIso8601String().split('T').first);
    final descCtrl = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: dateCtrl,
              readOnly: true,
              onTap: () => pickDateIntoController(context: context, controller: dateCtrl),
              decoration: const InputDecoration(
                labelText: 'Due Date',
                suffixIcon: Icon(Icons.calendar_today_rounded),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                if (dateCtrl.text.trim().isEmpty) return;
                await controller.addFollowup(dueDate: dateCtrl.text.trim(), description: descCtrl.text.trim());
                if (context.mounted) Navigator.of(context).pop();
              },
              child: const Text('Save Follow-up'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivitiesTab extends StatelessWidget {
  const _ActivitiesTab({required this.controller});
  final CrmLeadDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.activities.isEmpty) return const Center(child: Text('No activities yet'));
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: controller.activities.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final a = controller.activities[i];
          return ListTile(
            tileColor: Theme.of(context).cardColor,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            title: Text(a.description),
            subtitle: Text('${a.type} • ${formatIsoDate(a.createdAt)}'),
          );
        },
      );
    });
  }
}

class _FollowupsTab extends StatelessWidget {
  const _FollowupsTab({required this.controller});
  final CrmLeadDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.followups.isEmpty) return const Center(child: Text('No follow-ups yet'));
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: controller.followups.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final f = controller.followups[i];
          return ListTile(
            tileColor: Theme.of(context).cardColor,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            title: Text(f.description),
            subtitle: Text('Due ${formatIsoDate(f.dueDate)}'),
            trailing: f.isDone
                ? const Icon(Icons.check_circle, color: Colors.green)
                : TextButton(
                    onPressed: () => controller.markFollowupDone(f.id),
                    child: const Text('Mark done'),
                  ),
          );
        },
      );
    });
  }
}

