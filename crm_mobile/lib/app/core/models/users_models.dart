int _parseId(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

class AdminUserRow {
  AdminUserRow({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
  });

  final int id;
  final String name;
  final String email;
  final String role;
  final bool isActive;

  factory AdminUserRow.fromJson(Map<String, dynamic> json) {
    return AdminUserRow(
      id: _parseId(json['id']),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      isActive: json['is_active'] == true,
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
