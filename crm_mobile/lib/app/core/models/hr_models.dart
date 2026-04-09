int _parseId(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

num _parseNum(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v;
  return num.tryParse(v.toString()) ?? 0;
}

class HrEmployeeRow {
  HrEmployeeRow({
    required this.id,
    required this.userId,
    required this.userName,
    required this.employeeCode,
    required this.designation,
    required this.department,
  });

  /// `employees.id` (payroll / legacy HR).
  final int id;
  /// `users.id` — required for marking attendance (`POST /hr/attendance`).
  final int userId;
  final String userName;
  final String employeeCode;
  final String designation;
  final String department;

  String get title => userName.isNotEmpty ? userName : employeeCode;

  bool get hasLinkedUser => userId > 0;

  factory HrEmployeeRow.fromJson(Map<String, dynamic> json) {
    return HrEmployeeRow(
      id: _parseId(json['id']),
      userId: _parseId(json['user_id']),
      userName: (json['user_name'] ?? '').toString(),
      employeeCode: (json['employee_code'] ?? '').toString(),
      designation: (json['designation'] ?? '—').toString(),
      department: (json['department'] ?? '—').toString(),
    );
  }
}

class AttendanceSummaryRow {
  AttendanceSummaryRow({
    required this.name,
    required this.employeeCode,
    required this.present,
    required this.absent,
    required this.halfDay,
    required this.leave,
  });

  final String name;
  final String employeeCode;
  final num present;
  final num absent;
  final num halfDay;
  final num leave;

  String get title => name.isNotEmpty ? name : employeeCode;

  factory AttendanceSummaryRow.fromJson(Map<String, dynamic> json) {
    return AttendanceSummaryRow(
      name: (json['name'] ?? '').toString(),
      employeeCode: (json['employee_code'] ?? '').toString(),
      present: _parseNum(json['present']),
      absent: _parseNum(json['absent']),
      halfDay: _parseNum(json['half_day']),
      leave: _parseNum(json['leave']),
    );
  }
}

class PayrollRow {
  PayrollRow({
    required this.id,
    required this.employeeName,
    required this.employeeCode,
    required this.net,
    required this.status,
  });

  final int id;
  final String employeeName;
  final String employeeCode;
  final dynamic net;
  final String status;

  String get title => employeeName.isNotEmpty ? employeeName : employeeCode;

  factory PayrollRow.fromJson(Map<String, dynamic> json) {
    return PayrollRow(
      id: _parseId(json['id']),
      employeeName: (json['employee_name'] ?? '').toString(),
      employeeCode: (json['employee_code'] ?? '').toString(),
      net: json['net'],
      status: (json['status'] ?? 'draft').toString(),
    );
  }
}
