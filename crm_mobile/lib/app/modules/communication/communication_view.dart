import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'communication_controller.dart';

class CommunicationView extends GetView<CommunicationController> {
  const CommunicationView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: controller.selectedTab.value,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Communication'),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            tabs: const [Tab(text: 'Templates'), Tab(text: 'Chat')],
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
                    _WhatsAppInboxTab(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
        bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.communication),
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
                subtitle: Text('${t.channel} • ${t.bodyPreview}', maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
            );
          },
        ),
      );
    });
  }
}

class _WhatsAppInboxTab extends StatelessWidget {
  const _WhatsAppInboxTab({required this.controller});
  final CommunicationController controller;
  static final RxString _query = ''.obs;

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final t = parts.first;
      return t.length >= 2 ? t.substring(0, 2).toUpperCase() : t.substring(0, 1).toUpperCase();
    }
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final q = _query.value.trim().toLowerCase();
      final data = q.isEmpty
          ? controller.whatsappInbox
          : controller.whatsappInbox.where((row) {
              final title = row.leadCompany.trim().isEmpty ? row.leadName : row.leadCompany;
              final hay = '${title.toLowerCase()} ${row.leadPhone.toLowerCase()} ${row.lastBody.toLowerCase()}';
              return hay.contains(q);
            }).toList();

      if (controller.whatsappInbox.isEmpty) {
        return RefreshIndicator(
          onRefresh: controller.loadWhatsAppInbox,
          child: ListView(
            children: const [
              SizedBox(height: 120),
              Center(child: Text('No WhatsApp chats yet')),
            ],
          ),
        );
      }

      return RefreshIndicator(
        onRefresh: controller.loadWhatsAppInbox,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'INBOX',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).hintColor,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.35,
                  ),
            ),
            const SizedBox(height: 8),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                labelText: 'Search chats…',
              ),
              onChanged: (v) => _query.value = v,
            ),
            const SizedBox(height: 12),
            if (data.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 40),
                child: Center(child: Text('No chats match your search')),
              )
            else
              ...List.generate(data.length, (i) {
                final row = data[i];
                final title = row.leadCompany.trim().isEmpty ? row.leadName : row.leadCompany;
                final subtitle = row.lastBody.trim().isEmpty ? '—' : row.lastBody.trim();

                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      onTap: () => Get.toNamed('/whatsapp/${row.leadId}'),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: const Color(0xFFEEEDFE),
                        child: Text(
                          _initials(title),
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF3C3489)),
                        ),
                      ),
                      title: Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Text(formatIsoDate(row.lastSentAt), style: Theme.of(context).textTheme.bodySmall),
                    ),
                  ),
                );
              }),
          ],
        ),
      );
    });
  }
}
