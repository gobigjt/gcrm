import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/notification_item.dart';
import '../../core/navigation/notification_navigation.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../showcase/showcase_widgets.dart';
import 'notifications_controller.dart';

class NotificationsView extends GetView<NotificationsController> {
  const NotificationsView({super.key});

  static DateTime? _parseDay(String createdAt) {
    if (createdAt.isEmpty) return null;
    final s = createdAt.length >= 10 ? createdAt.substring(0, 10) : createdAt;
    return DateTime.tryParse(s);
  }

  static String _bucketLabel(DateTime? d, DateTime today) {
    if (d == null) return 'Earlier';
    final day = DateTime(d.year, d.month, d.day);
    final t0 = DateTime(today.year, today.month, today.day);
    if (day == t0) return 'Today';
    if (day == t0.subtract(const Duration(days: 1))) return 'Yesterday';
    return 'Earlier';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.notifications),
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () => controller.markAllRead(),
            child: const Text('Mark all read'),
          ),
          IconButton(
            onPressed: controller.load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'clear-read') controller.clearRead();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'clear-read', child: Text('Clear read')),
            ],
          ),
        ],
      ),
      body: Column(
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
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) {
                return const Center(child: CircularProgressIndicator());
              }
              if (controller.items.isEmpty) {
                return const Center(child: Text('No notifications yet'));
              }
              final today = DateTime.now();
              final sorted = List<NotificationItem>.from(controller.items)
                ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

              final sections = <String, List<NotificationItem>>{};
              for (final it in sorted) {
                final d = _parseDay(it.createdAt);
                final key = _bucketLabel(d, today);
                sections.putIfAbsent(key, () => []).add(it);
              }

              const order = ['Today', 'Yesterday', 'Earlier'];
              final children = <Widget>[];
              for (final key in order) {
                final rows = sections[key];
                if (rows == null || rows.isEmpty) continue;
                children.add(
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                    child: ShowcaseSectionTitle(key),
                  ),
                );
                for (final it in rows) {
                  children.add(
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: _NotificationTile(
                        item: it,
                        onMarkRead: () => controller.markRead(it.id),
                        onOpenTarget: () async {
                          if (openNotificationTarget(it.link)) {
                            await controller.markRead(it.id);
                          }
                        },
                      ),
                    ),
                  );
                }
              }

              return Stack(
                children: [
                  RefreshIndicator(
                    onRefresh: controller.load,
                    child: ListView(
                      padding: const EdgeInsets.only(bottom: 24),
                      children: children,
                    ),
                  ),
                  if (controller.isMutating.value)
                    const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(minHeight: 2)),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.item,
    required this.onMarkRead,
    required this.onOpenTarget,
  });

  final NotificationItem item;
  final VoidCallback onMarkRead;
  final VoidCallback onOpenTarget;

  @override
  Widget build(BuildContext context) {
    final isRead = item.isRead;
    final title = item.title;
    final body = item.body;
    final type = item.type;
    final module = item.module;
    final time = _fmtDate(item.createdAt);

    final canOpen = parseLeadIdFromNotificationLink(item.link) != null;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: canOpen ? onOpenTarget : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        leading: CircleAvatar(
          radius: 8,
          backgroundColor: isRead ? Colors.grey.shade400 : const Color(0xFF2563EB),
        ),
        title: Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
              ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            if (body.isNotEmpty) Text(body),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                Chip(label: Text(type.toUpperCase())),
                Chip(label: Text(module)),
                Text(time, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ],
        ),
        trailing: isRead
            ? canOpen
                ? IconButton(
                    onPressed: onOpenTarget,
                    icon: const Icon(Icons.chevron_right_rounded),
                    tooltip: 'Open lead',
                  )
                : const Icon(Icons.done_all_rounded, color: Colors.green)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (canOpen)
                    TextButton(
                      onPressed: onOpenTarget,
                      child: const Text('Open'),
                    ),
                  TextButton(onPressed: onMarkRead, child: const Text('Read')),
                ],
              ),
      ),
    );
  }
}

String _fmtDate(dynamic value) {
  if (value == null) return '—';
  final s = value.toString();
  if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
  return s;
}
