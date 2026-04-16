import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart'
    show formatCurrencyInr, formatIsoDate, parseLocalCalendarDay, pickDateIntoController;
import '../auth/auth_controller.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../showcase/showcase_widgets.dart';
import 'crm_edit_lead_view.dart';
import 'crm_lead_detail_controller.dart';
import 'crm_quote_nav.dart';
import 'package:url_launcher/url_launcher.dart';

String _priorityShort(String p) {
  switch (p) {
    case 'hot':
      return 'HIGH';
    case 'cold':
      return 'LOW';
    default:
      return 'MED';
  }
}

Future<void> _openEditFollowupSheet(
  BuildContext context,
  CrmLeadDetailController controller,
  CrmFollowupRow f,
) async {
  final ymd = formatIsoDate(f.dueDate);
  final dateCtrl = TextEditingController(text: ymd == '—' ? '' : ymd);
  final descCtrl = TextEditingController(text: f.description);
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
          Obx(
            () => FilledButton(
              onPressed: controller.isSubmitting.value
                  ? null
                  : () async {
                      if (dateCtrl.text.trim().isEmpty) return;
                      await controller.updateFollowup(
                        followupId: f.id,
                        dueDate: dateCtrl.text.trim(),
                        description: descCtrl.text.trim(),
                      );
                      if (context.mounted) Navigator.of(context).pop();
                    },
              child: const Text('Save changes'),
            ),
          ),
        ],
      ),
    ),
  );
}

Future<void> _confirmDeleteFollowupSheet(
  BuildContext context,
  CrmLeadDetailController controller,
  CrmFollowupRow f,
) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Delete task?'),
      content: Text(f.description.isEmpty ? 'Remove this follow-up?' : 'Remove: ${f.description}?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;
  await controller.deleteFollowup(f.id);
}

class CrmLeadDetailView extends StatelessWidget {
  const CrmLeadDetailView({super.key, required this.leadId});

  final int leadId;

  String _initialsFor(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final t = parts.first;
      return t.length >= 2 ? t.substring(0, 2).toUpperCase() : t.substring(0, 1).toUpperCase();
    }
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  Future<void> _openDialer(String phone) async {
    final p = phone.trim();
    if (p.isEmpty) return;
    final uri = Uri.parse('tel:$p');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      Get.snackbar('Call', 'Could not open dialer.');
    }
  }

  Future<void> _openWhatsApp(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return;
    final uri = Uri.parse('https://wa.me/$digits');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      Get.snackbar('WhatsApp', 'Could not open WhatsApp.');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (leadId <= 0) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
          title: const Text('Lead'),
        ),
        body: const Center(child: Text('Invalid or missing lead link.')),
      );
    }
    final controller = Get.put(CrmLeadDetailController(leadId: leadId), tag: 'lead-$leadId');
    return Obx(() {
      if (controller.isLoading.value && controller.lead.value == null) {
        return Scaffold(
          appBar: AppBar(
            leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
            title: const Text('Lead'),
          ),
          body: const Center(child: CircularProgressIndicator()),
        );
      }
      final lead = controller.lead.value ?? CrmLead.placeholder;
      final title = 'Lead details';
      final hues = [0xFF5C6BC0, 0xFF26A69A, 0xFFEC407A, 0xFFAB47BC, 0xFFFF7043];
      final avatarBg = Color(hues[lead.id.abs() % hues.length]);
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final headline = lead.displayTitle;
      final subParts = <String>[];
      if (lead.jobTitle.trim().isNotEmpty) subParts.add(lead.jobTitle.trim());
      if (lead.leadSegment.trim().isNotEmpty) subParts.add(lead.leadSegment.trim());
      final subLine = subParts.join(' · ');
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
          title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
          actions: [
            IconButton(
              onPressed: () => Get.to(() => CrmEditLeadView(leadId: leadId)),
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit lead',
            ),
            Obx(() {
              final l = controller.lead.value;
              if (l == null || l.isConverted) return const SizedBox.shrink();
              final hasContact = l.email.trim().isNotEmpty || l.phone.trim().isNotEmpty;
              if (!hasContact) return const SizedBox.shrink();
              return IconButton(
                tooltip: 'Convert to customer',
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        try {
                          final r = await controller.convertToCustomer();
                          final existed = r?['already_existed'] == true;
                          Get.snackbar(
                            existed ? 'Customer exists' : 'Customer created',
                            existed
                                ? 'This lead is already linked to a customer in Sales.'
                                : 'Contact saved under Sales → Customers.',
                          );
                        } catch (e) {
                          Get.snackbar('Could not convert', userFriendlyError(e));
                        }
                      },
                icon: const Icon(Icons.person_add_alt_1_outlined),
              );
            }),
            IconButton(onPressed: controller.load, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
          ],
        ),
        body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Obx(
                  () => AppErrorBanner(
                    message: controller.errorMessage.value,
                    onRetry: controller.load,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: avatarBg,
                          child: Text(
                            _initialsFor(headline),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                headline,
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              if (lead.company.trim().isNotEmpty && lead.company.trim() != headline) ...[
                                const SizedBox(height: 2),
                                Text(
                                  lead.company.trim(),
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                                ),
                              ],
                              if (subLine.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  subLine,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: Theme.of(context).hintColor,
                                        fontWeight: FontWeight.w600,
                                      ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        ShowcaseStagePill(lead.stage),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainer,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: isDark ? 0.65 : 0.35),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Qualifiers',
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  'Score ${lead.leadScore.toStringAsFixed(1)}',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: _InfoBlock(
                                  bg: isDark ? const Color(0xFF3D3310) : const Color(0xFFFAEEDA),
                                  fg: isDark ? const Color(0xFFFFE082) : const Color(0xFF633806),
                                  label: 'Potential',
                                  value: _priorityShort(lead.priority),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _InfoBlock(
                                  bg: isDark ? const Color(0xFF1A3A5C) : const Color(0xFFE6F1FB),
                                  fg: isDark ? const Color(0xFF93C5FD) : const Color(0xFF0C447C),
                                  label: 'Lead stage',
                                  value: lead.stage,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _InfoBlock(
                                  bg: isDark ? const Color(0xFF0D2818) : const Color(0xFFE1F5EE),
                                  fg: isDark ? const Color(0xFF6EE7B7) : const Color(0xFF085041),
                                  label: 'Deal (₹)',
                                  value: lead.dealSize != null
                                      ? formatCurrencyInr(lead.dealSize, decimals: 0)
                                      : '—',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: _MiniInfoCard(
                                  label: 'Assigned',
                                  value: lead.assignedName.trim().isEmpty ? 'Unassigned' : lead.assignedName.trim(),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _MiniInfoCard(
                                  label: 'Manager',
                                  value: lead.assignedManagerName.trim().isEmpty ? 'Unassigned' : lead.assignedManagerName.trim(),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Move stage',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          Obx(
                            () => Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: controller.stages.map((s) {
                                final selected = s.name.trim().toLowerCase() == lead.stage.trim().toLowerCase();
                                return ChoiceChip(
                                  label: Text(s.name),
                                  selected: selected,
                                  onSelected: controller.isSubmitting.value || selected
                                      ? null
                                      : (_) async {
                                          await controller.changeStage(s.id);
                                          Get.snackbar('Stage updated', 'Lead moved to ${s.name}');
                                        },
                                  visualDensity: VisualDensity.compact,
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 8),
                          _DetailIconRow(icon: Icons.sell_outlined, label: 'Lead source', value: lead.source),
                          _DetailIconRow(
                            icon: Icons.category_outlined,
                            label: 'Product category',
                            value: lead.productCategory.trim().isEmpty ? '—' : lead.productCategory.trim(),
                          ),
                          if (lead.tags.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Text('Tags', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: lead.tags
                                  .map(
                                    (t) => Chip(
                                      label: Text(t, style: const TextStyle(fontSize: 12)),
                                      visualDensity: VisualDensity.compact,
                                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                          if (lead.notes.trim().isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Text('Notes', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(lead.notes.trim(), style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    Theme(
                      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        initiallyExpanded: true,
                        tilePadding: EdgeInsets.zero,
                        title: Text(
                          'Contact info',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        childrenPadding: const EdgeInsets.only(bottom: 8),
                        children: [
                          _DetailIconRow(
                            icon: Icons.phone_android_rounded,
                            label: 'Mobile',
                            value: lead.phone.trim().isEmpty ? '—' : lead.phone.trim(),
                            onTap: lead.phone.trim().isEmpty ? null : () => _openDialer(lead.phone),
                          ),
                          _DetailIconRow(
                            icon: Icons.chat_rounded,
                            label: 'WhatsApp',
                            value: lead.phone.trim().isEmpty ? '—' : lead.phone.trim(),
                            onTap: lead.phone.trim().isEmpty ? null : () => _openWhatsApp(lead.phone),
                          ),
                          _DetailIconRow(icon: Icons.email_outlined, label: 'Email', value: lead.email.trim().isEmpty ? '—' : lead.email.trim()),
                          _DetailIconRow(icon: Icons.language_rounded, label: 'Website', value: lead.website.trim().isEmpty ? '—' : lead.website.trim()),
                          _DetailIconRow(icon: Icons.place_outlined, label: 'Address', value: lead.address.trim().isEmpty ? '—' : lead.address.trim()),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: _LeadActionCard(
                        bg: const Color(0xFF185FA5),
                        fg: Colors.white,
                        label: 'Log call',
                        icon: Icons.phone_in_talk_rounded,
                        onTap: () => _quickActivity(context, controller, 'call'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _LeadActionCard(
                        bg: Theme.of(context).colorScheme.surfaceContainerHighest,
                        fg: Theme.of(context).colorScheme.onSurface,
                        outline: true,
                        label: 'Sales / Quote',
                        icon: Icons.receipt_long_outlined,
                        onTap: () => navigateSalesFlowForLead(context, lead),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: ShowcaseSectionTitle('Activity timeline'),
              ),
            ),
            _ActivityTimelineSliver(controller: controller),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
                child: ShowcaseSectionTitle('Follow-ups'),
              ),
            ),
            _FollowupsSliver(
              controller: controller,
              canManageTasks: canManageCrmFollowupTasks(Get.find<AuthController>().role.value),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 88)),
          ],
        ),
        floatingActionButton: Obx(
          () => FloatingActionButton.extended(
            onPressed: controller.isSubmitting.value ? null : () => _openAddMenu(context, controller),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Add'),
          ),
        ),
      );
    });
  }

  void _openAddMenu(BuildContext context, CrmLeadDetailController controller) {
    final canManage = canManageCrmFollowupTasks(Get.find<AuthController>().role.value);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.history_edu_rounded),
              title: const Text('Add activity'),
              onTap: () {
                Navigator.pop(ctx);
                _openAddActivity(context, controller);
              },
            ),
            if (canManage)
              ListTile(
                leading: const Icon(Icons.event_note_rounded),
                title: const Text('Add follow-up'),
                onTap: () {
                  Navigator.pop(ctx);
                  _openAddFollowup(context, controller);
                },
              ),
          ],
        ),
      ),
    );
  }

  void _quickActivity(
    BuildContext context,
    CrmLeadDetailController controller,
    String type,
  ) {
    final typeCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    typeCtrl.text = type;
    descCtrl.text = '';

    showModalBottomSheet<void>(
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
            Text('Quick action', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            TextField(
              readOnly: true,
              controller: typeCtrl,
              decoration: const InputDecoration(labelText: 'Type'),
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
              onPressed: controller.isSubmitting.value
                  ? null
                  : () async {
                      if (descCtrl.text.trim().isEmpty) return;
                      await controller.addActivity(type: type, description: descCtrl.text.trim());
                      if (context.mounted) Navigator.of(context).pop();
                    },
              child: const Text('Save'),
            ),
          ],
        ),
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

class _ActivityTimelineSliver extends StatelessWidget {
  const _ActivityTimelineSliver({required this.controller});

  final CrmLeadDetailController controller;

  Color _activityColor(String type) {
    final t = type.toLowerCase();
    if (t.contains('email')) return const Color(0xFF185FA5);
    if (t.contains('call')) return const Color(0xFF1D9E75);
    if (t.contains('qualif') || t.contains('won')) return const Color(0xFFEF9F27);
    if (t.contains('whatsapp')) return const Color(0xFF185FA5);
    return const Color(0xFFB4B2A9);
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.activities.isEmpty) {
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('No activities yet', style: TextStyle(color: Theme.of(context).hintColor)),
          ),
        );
      }
      final n = controller.activities.length;
      return SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, i) {
            final a = controller.activities[i];
            final isLast = i == n - 1;
            final dotColor = _activityColor(a.type);
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 34,
                    child: Column(
                      children: [
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                        ),
                        if (!isLast)
                          Container(
                            width: 2,
                            height: 48,
                            color: dotColor.withValues(alpha: 0.35),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.description,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${a.type} • ${formatIsoDate(a.createdAt)}',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
          childCount: n,
        ),
      );
    });
  }
}

class _FollowupsSliver extends StatelessWidget {
  const _FollowupsSliver({required this.controller, required this.canManageTasks});

  final CrmLeadDetailController controller;
  final bool canManageTasks;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final open = controller.followups.where((f) => !f.isDone).toList();
      if (open.isEmpty) {
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('No open follow-ups', style: TextStyle(color: Theme.of(context).hintColor)),
          ),
        );
      }

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final weekEnd = today.add(const Duration(days: 7));

      final overdue = open.where((f) => (parseLocalCalendarDay(f.dueDate)?.isBefore(today) ?? false)).toList()
        ..sort((a, b) => (parseLocalCalendarDay(a.dueDate) ?? today).compareTo(parseLocalCalendarDay(b.dueDate) ?? today));

      final todayItems = open.where((f) {
        final d = parseLocalCalendarDay(f.dueDate);
        return d != null && d.year == today.year && d.month == today.month && d.day == today.day;
      }).toList();

      final thisWeek = open.where((f) {
        final d = parseLocalCalendarDay(f.dueDate);
        if (d == null) return false;
        final isAfterToday = d.isAfter(today);
        final within = d.isBefore(weekEnd.add(const Duration(days: 1))) || d.isAtSameMomentAs(weekEnd);
        return isAfterToday && within;
      }).toList();

      final children = <Widget>[];

      void addSection(String title, int count, Color dotColor, List<CrmFollowupRow> rows) {
        if (rows.isEmpty) return;
        children.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: Text(
              '$title ($count)',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800, color: dotColor),
            ),
          ),
        );
        for (final f in rows) {
          children.add(
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Material(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        margin: const EdgeInsets.only(top: 6, right: 10),
                        decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              f.description,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Due ${formatIsoDate(f.dueDate)}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: controller.isSubmitting.value ? null : () => controller.markFollowupDone(f.id),
                            child: const Text('Done'),
                          ),
                          if (canManageTasks && !f.isDone)
                            TextButton(
                              onPressed: controller.isSubmitting.value
                                  ? null
                                  : () => _openEditFollowupSheet(context, controller, f),
                              child: const Text('Edit'),
                            ),
                          if (canManageTasks)
                            TextButton(
                              onPressed: controller.isSubmitting.value
                                  ? null
                                  : () => _confirmDeleteFollowupSheet(context, controller, f),
                              child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
      }

      addSection('Overdue', overdue.length, const Color(0xFFE24B4A), overdue);
      addSection('Today', todayItems.length, const Color(0xFFEF9F27), todayItems);
      addSection('This week', thisWeek.length, const Color(0xFF185FA5), thisWeek);

      return SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, i) => children[i],
          childCount: children.length,
        ),
      );
    });
  }
}

class _MiniInfoCard extends StatelessWidget {
  const _MiniInfoCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).hintColor,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _DetailIconRow extends StatelessWidget {
  const _DetailIconRow({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          if (onTap != null)
            Icon(
              Icons.open_in_new_rounded,
              size: 16,
              color: Theme.of(context).hintColor,
            ),
        ],
      ),
    );
    if (onTap == null) return content;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: content,
    );
  }
}

class _LeadActionCard extends StatelessWidget {
  const _LeadActionCard({
    required this.bg,
    required this.fg,
    this.outline = false,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final Color bg;
  final Color fg;
  final bool outline;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = outline ? fg.withValues(alpha: 0.28) : Colors.transparent;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Ink(
        height: 54,
        decoration: BoxDecoration(
          color: outline ? Colors.transparent : bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 8),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: fg,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({
    required this.bg,
    required this.fg,
    required this.label,
    required this.value,
  });

  final Color bg;
  final Color fg;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: fg, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}
