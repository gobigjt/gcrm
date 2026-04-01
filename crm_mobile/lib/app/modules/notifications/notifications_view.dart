import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/notification_item.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'notifications_controller.dart';

class NotificationsView extends GetView<NotificationsController> {
  const NotificationsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            onPressed: controller.load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'read-all') controller.markAllRead();
              if (v == 'clear-read') controller.clearRead();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'read-all', child: Text('Mark all read')),
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
              return Stack(
                children: [
                  RefreshIndicator(
                    onRefresh: controller.load,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemBuilder: (_, i) => _NotificationTile(
                        item: controller.items[i],
                        onMarkRead: () => controller.markRead(controller.items[i].id),
                      ),
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemCount: controller.items.length,
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
  const _NotificationTile({required this.item, required this.onMarkRead});

  final NotificationItem item;
  final VoidCallback onMarkRead;

  @override
  Widget build(BuildContext context) {
    final isRead = item.isRead;
    final title = item.title;
    final body = item.body;
    final type = item.type;
    final module = item.module;
    final time = _fmtDate(item.createdAt);

    return Card(
      child: ListTile(
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
            ? const Icon(Icons.done_all_rounded, color: Colors.green)
            : TextButton(onPressed: onMarkRead, child: const Text('Read')),
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
