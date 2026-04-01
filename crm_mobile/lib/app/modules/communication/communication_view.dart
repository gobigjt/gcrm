import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'communication_controller.dart';

class CommunicationView extends GetView<CommunicationController> {
  const CommunicationView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Communication'),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            tabs: const [Tab(text: 'Templates'), Tab(text: 'Logs')],
          ),
        ),
        floatingActionButton: Obx(() {
          if (controller.selectedTab.value == 0) {
            return FloatingActionButton.extended(
              onPressed: () => _openCreateTemplateSheet(context),
              icon: const Icon(Icons.text_snippet_rounded),
              label: const Text('New Template'),
            );
          }
          return FloatingActionButton.extended(
            onPressed: () => _openCreateLogSheet(context),
            icon: const Icon(Icons.send_rounded),
            label: const Text('Log Message'),
          );
        }),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Obx(
                () => AppErrorBanner(
                  message: controller.errorMessage.value,
                  onRetry: controller.loadAll,
                ),
              ),
            ),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value) {
                  return const Center(child: CircularProgressIndicator());
                }
                return TabBarView(
                  children: [
                    _TemplatesTab(controller: controller),
                    _LogsTab(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openCreateTemplateSheet(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final subjectCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    final channel = 'email'.obs;

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
        child: Obx(
          () => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: channel.value,
                items: const [
                  DropdownMenuItem(value: 'email', child: Text('Email')),
                  DropdownMenuItem(value: 'whatsapp', child: Text('WhatsApp')),
                  DropdownMenuItem(value: 'sms', child: Text('SMS')),
                ],
                onChanged: (v) => channel.value = v ?? 'email',
                decoration: const InputDecoration(labelText: 'Channel'),
              ),
              const SizedBox(height: 8),
              TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject')),
              const SizedBox(height: 8),
              TextField(
                controller: bodyCtrl,
                decoration: const InputDecoration(labelText: 'Body *'),
                minLines: 3,
                maxLines: 6,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty || bodyCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Name and body are required');
                          return;
                        }
                        await controller.createTemplate(
                          name: nameCtrl.text.trim(),
                          channel: channel.value,
                          subject: subjectCtrl.text.trim(),
                          body: bodyCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Template'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openCreateLogSheet(BuildContext context) async {
    final leadCtrl = TextEditingController();
    final recipientCtrl = TextEditingController();
    final subjectCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    final channel = 'email'.obs;
    final status = 'sent'.obs;

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
        child: Obx(
          () => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: leadCtrl, decoration: const InputDecoration(labelText: 'Lead ID (optional)')),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: channel.value,
                items: const [
                  DropdownMenuItem(value: 'email', child: Text('Email')),
                  DropdownMenuItem(value: 'whatsapp', child: Text('WhatsApp')),
                  DropdownMenuItem(value: 'sms', child: Text('SMS')),
                ],
                onChanged: (v) => channel.value = v ?? 'email',
                decoration: const InputDecoration(labelText: 'Channel'),
              ),
              const SizedBox(height: 8),
              TextField(controller: recipientCtrl, decoration: const InputDecoration(labelText: 'Recipient *')),
              const SizedBox(height: 8),
              TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject')),
              const SizedBox(height: 8),
              TextField(
                controller: bodyCtrl,
                decoration: const InputDecoration(labelText: 'Body *'),
                minLines: 3,
                maxLines: 6,
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: status.value,
                items: const [
                  DropdownMenuItem(value: 'sent', child: Text('Sent')),
                  DropdownMenuItem(value: 'failed', child: Text('Failed')),
                  DropdownMenuItem(value: 'queued', child: Text('Queued')),
                ],
                onChanged: (v) => status.value = v ?? 'sent',
                decoration: const InputDecoration(labelText: 'Status'),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        if (recipientCtrl.text.trim().isEmpty || bodyCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Recipient and body are required');
                          return;
                        }
                        await controller.createLog(
                          leadId: int.tryParse(leadCtrl.text.trim()),
                          channel: channel.value,
                          recipient: recipientCtrl.text.trim(),
                          subject: subjectCtrl.text.trim(),
                          body: bodyCtrl.text.trim(),
                          status: status.value,
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Log'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TemplatesTab extends StatelessWidget {
  const _TemplatesTab({required this.controller});
  final CommunicationController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.templates.isEmpty) return const Center(child: Text('No templates found'));
      return RefreshIndicator(
        onRefresh: controller.loadTemplates,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.templates.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final t = controller.templates[i];
            return Card(
              child: ListTile(
                title: Text(t.name),
                subtitle: Text('${t.channel} • ${t.subjectDisplay}'),
              ),
            );
          },
        ),
      );
    });
  }
}

class _LogsTab extends StatelessWidget {
  const _LogsTab({required this.controller});
  final CommunicationController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: controller.channelFilter.value.isEmpty ? null : controller.channelFilter.value,
                  items: const [
                    DropdownMenuItem(value: 'email', child: Text('Email')),
                    DropdownMenuItem(value: 'whatsapp', child: Text('WhatsApp')),
                    DropdownMenuItem(value: 'sms', child: Text('SMS')),
                  ],
                  onChanged: (v) => controller.channelFilter.value = v ?? '',
                  decoration: const InputDecoration(labelText: 'Channel filter'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: controller.loadLogs,
                icon: const Icon(Icons.filter_alt_rounded),
                tooltip: 'Apply filter',
              ),
            ],
          ),
        ),
        Expanded(
          child: Obx(() {
            if (controller.logs.isEmpty) return const Center(child: Text('No logs found'));
            return RefreshIndicator(
              onRefresh: controller.loadLogs,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: controller.logs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final l = controller.logs[i];
                  return Card(
                    child: ListTile(
                      title: Text('${l.channel} • ${l.recipient}'),
                      subtitle: Text('${l.status} • ${formatIsoDate(l.sentAt)}'),
                      trailing: Text(l.sentByName),
                    ),
                  );
                },
              ),
            );
          }),
        ),
      ],
    );
  }
}
