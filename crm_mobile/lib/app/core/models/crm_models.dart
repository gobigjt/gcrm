class CrmLead {
  CrmLead({
    required this.id,
    required this.name,
    required this.company,
    required this.stage,
    required this.source,
    required this.priority,
  });

  /// Shown when detail has not loaded yet (same defaults as [fromJson]).
  static final CrmLead placeholder = CrmLead(
    id: 0,
    name: 'Lead',
    company: 'No company',
    stage: 'Unassigned',
    source: 'Unknown',
    priority: 'warm',
  );

  final int id;
  final String name;
  final String company;
  final String stage;
  final String source;
  final String priority;

  factory CrmLead.fromJson(Map<String, dynamic> json) {
    return CrmLead(
      id: (json['id'] as num? ?? 0).toInt(),
      name: (json['name'] ?? 'Lead').toString(),
      company: (json['company'] ?? 'No company').toString(),
      stage: (json['stage'] ?? 'Unassigned').toString(),
      source: (json['source'] ?? 'Unknown').toString(),
      priority: (json['priority'] ?? 'warm').toString(),
    );
  }
}

class CrmActivityRow {
  CrmActivityRow({
    required this.description,
    required this.type,
    required this.createdAt,
  });

  final String description;
  final String type;
  final dynamic createdAt;

  factory CrmActivityRow.fromJson(Map<String, dynamic> json) {
    return CrmActivityRow(
      description: (json['description'] ?? '').toString(),
      type: (json['type'] ?? 'note').toString(),
      createdAt: json['created_at'],
    );
  }
}

class CrmFollowupRow {
  CrmFollowupRow({
    required this.id,
    required this.description,
    required this.dueDate,
    required this.isDone,
  });

  final int id;
  final String description;
  final dynamic dueDate;
  final bool isDone;

  factory CrmFollowupRow.fromJson(Map<String, dynamic> json) {
    final rawId = json['id'];
    final id = rawId is int ? rawId : (rawId is num ? rawId.toInt() : int.tryParse(rawId?.toString() ?? '') ?? 0);
    return CrmFollowupRow(
      id: id,
      description: (json['description'] ?? 'No description').toString(),
      dueDate: json['due_date'],
      isDone: json['is_done'] == true,
    );
  }
}

class CrmLookupItem {
  CrmLookupItem({required this.id, required this.name});

  final int id;
  final String name;

  factory CrmLookupItem.fromJson(Map<String, dynamic> json) {
    return CrmLookupItem(
      id: (json['id'] as num? ?? 0).toInt(),
      name: (json['name'] ?? '').toString(),
    );
  }
}
