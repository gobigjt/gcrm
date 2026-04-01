class CompanyProfile {
  CompanyProfile({
    required this.companyName,
    required this.gstin,
    required this.email,
    required this.phone,
    required this.address,
    required this.currency,
    required this.fiscalYearStart,
  });

  static final CompanyProfile empty = CompanyProfile(
    companyName: '',
    gstin: '',
    email: '',
    phone: '',
    address: '',
    currency: 'INR',
    fiscalYearStart: null,
  );

  final String companyName;
  final String gstin;
  final String email;
  final String phone;
  final String address;
  final String currency;
  final dynamic fiscalYearStart;

  factory CompanyProfile.fromJson(Map<String, dynamic> json) {
    return CompanyProfile(
      companyName: (json['company_name'] ?? '').toString(),
      gstin: (json['gstin'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      address: (json['address'] ?? '').toString(),
      currency: (json['currency'] ?? 'INR').toString(),
      fiscalYearStart: json['fiscal_year_start'],
    );
  }
}

class ModuleSettingRow {
  ModuleSettingRow({
    required this.moduleKey,
    required this.label,
    required this.isEnabled,
    required this.allowedRoles,
  });

  final String moduleKey;
  final String label;
  final bool isEnabled;
  final List<dynamic> allowedRoles;

  factory ModuleSettingRow.fromJson(Map<String, dynamic> json) {
    final roles = json['allowed_roles'];
    return ModuleSettingRow(
      moduleKey: (json['module'] ?? '').toString(),
      label: (json['label'] ?? json['module'] ?? '').toString(),
      isEnabled: json['is_enabled'] == true,
      allowedRoles: roles is List<dynamic> ? List<dynamic>.from(roles) : const [],
    );
  }
}
