import '../utils/ui_format.dart';

class NotificationItem {
  NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.module,
    this.link,
    required this.isRead,
    required this.createdAt,
  });

  final int id;
  final String title;
  final String body;
  final String type;
  final String module;
  final String? link;
  final bool isRead;
  final String createdAt;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    final rawLink = json['link'];
    return NotificationItem(
      id: parseDynamicInt(json['id']),
      title: (json['title'] ?? 'Notification').toString(),
      body: (json['body'] ?? '').toString(),
      type: (json['type'] ?? 'info').toString(),
      module: (json['module'] ?? 'general').toString(),
      link: rawLink?.toString(),
      isRead: json['is_read'] == true,
      createdAt: (json['created_at'] ?? '').toString(),
    );
  }
}
