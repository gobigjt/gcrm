import '../utils/ui_format.dart';

/// Row from GET /users/sales-managers (id, name, email only).
class SalesManagerPick {
  SalesManagerPick({required this.id, required this.name, required this.email});

  final int id;
  final String name;
  final String email;

  factory SalesManagerPick.fromJson(Map<String, dynamic> json) {
    return SalesManagerPick(
      id: parseDynamicInt(json['id']),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
    );
  }
}

bool isSalesExecutiveRole(String role) {
  final n = role.toLowerCase().replaceAll(RegExp(r'[\s_-]+'), '');
  return n == 'salesexecutive';
}

class AdminUserRow {
  AdminUserRow({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    this.zoneId,
    this.zoneName,
    this.salesManagerId,
    this.salesManagerName,
  });

  final int id;
  final String name;
  final String email;
  final String role;
  final bool isActive;
  final int? zoneId;
  final String? zoneName;
  final int? salesManagerId;
  final String? salesManagerName;

  factory AdminUserRow.fromJson(Map<String, dynamic> json) {
    return AdminUserRow(
      id: parseDynamicInt(json['id']),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      isActive: json['is_active'] == true,
      zoneId: tryParseDynamicInt(json['zone_id']),
      zoneName: json['zone_name']?.toString(),
      salesManagerId: tryParseDynamicInt(json['sales_manager_id']),
      salesManagerName: json['sales_manager_name']?.toString(),
    );
  }
}

class ZoneRow {
  ZoneRow({
    required this.id,
    required this.name,
    this.code,
  });

  final int id;
  final String name;
  final String? code;

  factory ZoneRow.fromJson(Map<String, dynamic> json) {
    return ZoneRow(
      id: parseDynamicInt(json['id']),
      name: (json['name'] ?? '').toString(),
      code: json['code']?.toString(),
    );
  }
}

class RoleOption {
  RoleOption({required this.name});

  final String name;

  factory RoleOption.fromJson(Map<String, dynamic> json) {
    return RoleOption(name: (json['name'] ?? 'Agent').toString());
  }
}
