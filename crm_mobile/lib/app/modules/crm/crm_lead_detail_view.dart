import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart' show formatCurrencyInr, formatIsoDate, pickDateIntoController;
import '../../shared/widgets/app_error_banner.dart';
import '../../showcase/showcase_widgets.dart';
import 'crm_lead_detail_controller.dart';

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
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
        title: const Text('Lead detail'),
        actions: [
          IconButton(onPressed: controller.load, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
        ],
      ),
      body: Obx(() {
        if (controller.isLoading.value && controller.lead.value == null) {
          return const Center(child: CircularProgressIndicator());
        }
        final lead = controller.lead.value ?? CrmLead.placeholder;
        return CustomScrollView(
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
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: const Color(0xFFEEEDFE),
                          child: Text(
                            _initialsFor(lead.company.isNotEmpty ? lead.company : lead.name),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF3C3489)),
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
                                '${lead.source} · ${lead.priority}',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                              ),
                            ],
                          ),
                        ),
                        ShowcaseStagePill(lead.stage),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _InfoBlock(
                            bg: const Color(0xFFE6F1FB),
                            fg: const Color(0xFF0C447C),
                            label: 'Value',
                            value: formatCurrencyInr((lead.leadScore * 1000).toInt()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _InfoBlock(
                            bg: const Color(0xFFFAEEDA),
                            fg: const Color(0xFF633806),
                            label: 'Score',
                            value: '${lead.leadScore}',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _InfoBlock(
                            bg: const Color(0xFFE1F5EE),
                            fg: const Color(0xFF085041),
                            label: 'Days',
                            value: '${DateTime.now().difference(lead.createdAt).inDays}',
                          ),
                        ),
                      ],
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
                        label: 'Send WA',
                        icon: Icons.chat_bubble_outline_rounded,
                        onTap: () => Get.toNamed('/whatsapp/$leadId'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _LeadActionCard(
                        bg: Theme.of(context).colorScheme.surfaceContainerHighest,
                        fg: Theme.of(context).colorScheme.onSurface,
                        outline: true,
                        label: 'Quote',
                        icon: Icons.receipt_long_rounded,
                        onTap: () => _quickActivity(context, controller, 'quote'),
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
            _FollowupsSliver(controller: controller),
            const SliverToBoxAdapter(child: SizedBox(height: 88)),
          ],
        );
      }),
      floatingActionButton: Obx(
        () => FloatingActionButton.extended(
          onPressed: controller.isSubmitting.value ? null : () => _openAddMenu(context, controller),
          icon: const Icon(Icons.add_rounded),
          label: const Text('Add'),
        ),
      ),
    );
  }

  void _openAddMenu(BuildContext context, CrmLeadDetailController controller) {
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
  const _FollowupsSliver({required this.controller});

  final CrmLeadDetailController controller;

  DateTime? _parseDue(dynamic v) {
    if (v == null) return null;
    final s = v.toString();
    final datePart = s.length >= 10 ? s.substring(0, 10) : s;
    return DateTime.tryParse(datePart);
  }

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

      final overdue = open.where((f) => (_parseDue(f.dueDate)?.isBefore(today) ?? false)).toList()
        ..sort((a, b) => (_parseDue(a.dueDate) ?? today).compareTo(_parseDue(b.dueDate) ?? today));

      final todayItems = open.where((f) {
        final d = _parseDue(f.dueDate);
        return d != null && d.year == today.year && d.month == today.month && d.day == today.day;
      }).toList();

      final thisWeek = open.where((f) {
        final d = _parseDue(f.dueDate);
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
                      TextButton(
                        onPressed: () => controller.markFollowupDone(f.id),
                        child: const Text('Done'),
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
