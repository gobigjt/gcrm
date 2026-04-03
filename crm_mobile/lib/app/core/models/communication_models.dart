class CommTemplateRow {
  CommTemplateRow({
    required this.name,
    required this.channel,
    required this.subject,
    required this.body,
  });

  final String name;
  final String channel;
  final String subject;
  final String body;

  String get subjectDisplay => subject.trim().isEmpty ? 'No subject' : subject;
  String get bodyPreview => body.trim().isEmpty ? '—' : body.trim();

  factory CommTemplateRow.fromJson(Map<String, dynamic> json) {
    return CommTemplateRow(
      name: (json['name'] ?? '').toString(),
      channel: (json['channel'] ?? '').toString(),
      subject: (json['subject'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
    );
  }
}

class CommLogRow {
  CommLogRow({
    required this.channel,
    required this.recipient,
    required this.body,
    this.leadId,
    required this.status,
    required this.sentAt,
    required this.sentByName,
  });

  final String channel;
  final String recipient;
  final String body;
  final int? leadId;
  final String status;
  final dynamic sentAt;
  final String sentByName;

  factory CommLogRow.fromJson(Map<String, dynamic> json) {
    return CommLogRow(
      channel: (json['channel'] ?? '').toString(),
      recipient: (json['recipient'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      leadId: (json['lead_id'] as num?)?.toInt(),
      status: (json['status'] ?? '').toString(),
      sentAt: json['sent_at'],
      sentByName: (json['sent_by_name'] ?? 'System').toString(),
    );
  }
}

class CommWhatsAppInboxRow {
  CommWhatsAppInboxRow({
    required this.leadId,
    required this.leadName,
    required this.leadCompany,
    required this.leadPhone,
    required this.leadStage,
    required this.leadScore,
    required this.lastBody,
    required this.lastSentAt,
    required this.lastSentByName,
  });

  final int leadId;
  final String leadName;
  final String leadCompany;
  final String leadPhone;
  final String leadStage;
  final int leadScore;
  final String lastBody;
  final dynamic lastSentAt;
  final String lastSentByName;

  factory CommWhatsAppInboxRow.fromJson(Map<String, dynamic> json) {
    return CommWhatsAppInboxRow(
      leadId: (json['lead_id'] as num? ?? 0).toInt(),
      leadName: (json['lead_name'] ?? '').toString(),
      leadCompany: (json['lead_company'] ?? '').toString(),
      leadPhone: (json['lead_phone'] ?? '').toString(),
      leadStage: (json['lead_stage'] ?? '').toString(),
      leadScore: (json['lead_score'] as num? ?? 0).toInt(),
      lastBody: (json['last_body'] ?? '').toString(),
      lastSentAt: json['last_sent_at'],
      lastSentByName: (json['last_sent_by_name'] ?? '').toString(),
    );
  }
}
