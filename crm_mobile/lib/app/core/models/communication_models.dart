class CommTemplateRow {
  CommTemplateRow({
    required this.name,
    required this.channel,
    required this.subject,
  });

  final String name;
  final String channel;
  final String subject;

  String get subjectDisplay => subject.trim().isEmpty ? 'No subject' : subject;

  factory CommTemplateRow.fromJson(Map<String, dynamic> json) {
    return CommTemplateRow(
      name: (json['name'] ?? '').toString(),
      channel: (json['channel'] ?? '').toString(),
      subject: (json['subject'] ?? '').toString(),
    );
  }
}

class CommLogRow {
  CommLogRow({
    required this.channel,
    required this.recipient,
    required this.status,
    required this.sentAt,
    required this.sentByName,
  });

  final String channel;
  final String recipient;
  final String status;
  final dynamic sentAt;
  final String sentByName;

  factory CommLogRow.fromJson(Map<String, dynamic> json) {
    return CommLogRow(
      channel: (json['channel'] ?? '').toString(),
      recipient: (json['recipient'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      sentAt: json['sent_at'],
      sentByName: (json['sent_by_name'] ?? 'System').toString(),
    );
  }
}
