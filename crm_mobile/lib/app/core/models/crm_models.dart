import '../utils/ui_format.dart';

class CrmLead {
  CrmLead({
    required this.id,
    required this.name,
    required this.company,
    required this.stage,
    required this.source,
    required this.priority,
    required this.leadScore,
    required this.createdAt,
    required this.phone,
    this.email = '',
    this.assignedName = '',
    this.leadSegment = '',
    this.jobTitle = '',
    this.productCategory = '',
    this.dealSize,
    this.website = '',
    this.address = '',
    this.tags = const [],
    this.notes = '',
    this.sourceId,
    this.stageId,
    this.assignedTo,
    this.assignedManagerId,
    this.isConverted = false,
  });

  static final CrmLead placeholder = CrmLead(
    id: 0,
    name: 'Lead',
    company: 'No company',
    stage: 'Unassigned',
    source: 'Unknown',
    priority: 'warm',
    leadScore: 0,
    createdAt: DateTime(2000, 1, 1),
    phone: '',
    sourceId: null,
    stageId: null,
    assignedTo: null,
    assignedManagerId: null,
    isConverted: false,
  );

  final int id;
  final String name;
  final String company;
  final String stage;
  final String source;
  final String priority;
  final double leadScore;
  final DateTime createdAt;
  final String phone;
  final String email;
  final String assignedName;
  final String leadSegment;
  final String jobTitle;
  final String productCategory;
  final double? dealSize;
  final String website;
  final String address;
  final List<String> tags;
  final String notes;
  final int? sourceId;
  final int? stageId;
  final int? assignedTo;
  final int? assignedManagerId;
  final bool isConverted;

  /// Primary line for list cards (name, else phone).
  String get displayTitle {
    final n = name.trim();
    if (n.isNotEmpty) return n;
    final p = phone.trim();
    if (p.isNotEmpty) return p;
    return company.trim().isNotEmpty ? company.trim() : 'Lead #$id';
  }

  /// Secondary line (company or email).
  String get displaySubtitle {
    if (company.trim().isNotEmpty && name.trim().isNotEmpty) return company.trim();
    if (email.trim().isNotEmpty) return email.trim();
    if (productCategory.trim().isNotEmpty) return productCategory.trim();
    return source;
  }

  static double _score(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static List<String> _tags(dynamic v) {
    if (v is List) return v.map((e) => e.toString()).where((s) => s.isNotEmpty).toList();
    return [];
  }

  static int? _nullableId(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  factory CrmLead.fromJson(Map<String, dynamic> json) {
    return CrmLead(
      id: parseDynamicInt(json['id']),
      name: (json['name'] ?? 'Lead').toString(),
      company: (json['company'] ?? '').toString(),
      stage: (json['stage'] ?? 'Unassigned').toString(),
      source: (json['source'] ?? 'Unknown').toString(),
      priority: (json['priority'] ?? 'warm').toString(),
      leadScore: _score(json['lead_score']),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ?? DateTime(2000, 1, 1),
      phone: (json['phone'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      assignedName: (json['assigned_name'] ?? '').toString(),
      leadSegment: (json['lead_segment'] ?? '').toString(),
      jobTitle: (json['job_title'] ?? '').toString(),
      productCategory: (json['product_category'] ?? '').toString(),
      dealSize: json['deal_size'] != null ? _score(json['deal_size']) : null,
      website: (json['website'] ?? '').toString(),
      address: (json['address'] ?? '').toString(),
      tags: _tags(json['tags']),
      notes: (json['notes'] ?? '').toString(),
      sourceId: _nullableId(json['source_id']),
      stageId: _nullableId(json['stage_id']),
      assignedTo: _nullableId(json['assigned_to']),
      assignedManagerId: _nullableId(json['assigned_manager_id']),
      isConverted: json['is_converted'] == true,
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
    required this.leadId,
    this.leadName,
    this.leadStage,
    this.leadScore,
    required this.id,
    required this.description,
    required this.dueDate,
    required this.isDone,
  });

  final int leadId;
  final String? leadName;
  final String? leadStage;
  final int? leadScore;
  final int id;
  final String description;
  final dynamic dueDate;
  final bool isDone;

  factory CrmFollowupRow.fromJson(Map<String, dynamic> json) {
    final rawLeadId = json['lead_id'] ?? json['leadId'];
    final leadId = rawLeadId is int
        ? rawLeadId
        : (rawLeadId is num ? rawLeadId.toInt() : int.tryParse(rawLeadId?.toString() ?? '') ?? 0);

    final rawId = json['id'];
    final id = rawId is int ? rawId : (rawId is num ? rawId.toInt() : int.tryParse(rawId?.toString() ?? '') ?? 0);
    return CrmFollowupRow(
      leadId: leadId,
      id: id,
      description: (json['description'] ?? 'No description').toString(),
      leadName: (json['lead_name'] ?? json['leadName'])?.toString(),
      leadStage: (json['lead_stage'] ?? json['leadStage'])?.toString(),
      leadScore: tryParseDynamicInt(json['lead_score']),
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
      id: parseDynamicInt(json['id']),
      name: (json['name'] ?? '').toString(),
    );
  }
}
