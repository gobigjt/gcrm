class PurchaseVendor {
  PurchaseVendor({
    required this.name,
    required this.email,
    required this.phone,
    required this.gstin,
  });

  final String name;
  final String email;
  final String phone;
  final String gstin;

  bool get hasGstin => gstin.trim().isNotEmpty;

  factory PurchaseVendor.fromJson(Map<String, dynamic> json) {
    return PurchaseVendor(
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '—').toString(),
      phone: (json['phone'] ?? '—').toString(),
      gstin: (json['gstin'] ?? '').toString(),
    );
  }
}

class PurchaseOrderRow {
  PurchaseOrderRow({
    required this.poNumber,
    required this.vendorName,
    required this.status,
    required this.totalAmount,
  });

  final String poNumber;
  final String vendorName;
  final String status;
  final num totalAmount;

  factory PurchaseOrderRow.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderRow(
      poNumber: (json['po_number'] ?? 'PO').toString(),
      vendorName: (json['vendor_name'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      totalAmount: json['total_amount'] as num? ?? 0,
    );
  }
}

class GrnRow {
  GrnRow({
    required this.grnNumber,
    required this.vendorName,
    required this.poNumber,
    required this.receivedAt,
  });

  final String grnNumber;
  final String vendorName;
  final String poNumber;
  final dynamic receivedAt;

  factory GrnRow.fromJson(Map<String, dynamic> json) {
    return GrnRow(
      grnNumber: (json['grn_number'] ?? 'GRN').toString(),
      vendorName: (json['vendor_name'] ?? '').toString(),
      poNumber: (json['po_number'] ?? '').toString(),
      receivedAt: json['received_at'],
    );
  }
}
