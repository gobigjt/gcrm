class SalesCustomer {
  SalesCustomer({
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

  factory SalesCustomer.fromJson(Map<String, dynamic> json) {
    return SalesCustomer(
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '—').toString(),
      phone: (json['phone'] ?? '—').toString(),
      gstin: (json['gstin'] ?? '').toString(),
    );
  }
}

class SalesQuotation {
  SalesQuotation({
    required this.quotationNumber,
    required this.customerName,
    required this.status,
    required this.totalAmount,
  });

  final String quotationNumber;
  final String customerName;
  final String status;
  final num totalAmount;

  factory SalesQuotation.fromJson(Map<String, dynamic> json) {
    return SalesQuotation(
      quotationNumber: (json['quotation_number'] ?? 'Quotation').toString(),
      customerName: (json['customer_name'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      totalAmount: json['total_amount'] as num? ?? 0,
    );
  }
}

class SalesOrderRow {
  SalesOrderRow({
    required this.orderNumber,
    required this.customerName,
    required this.status,
    required this.totalAmount,
  });

  final String orderNumber;
  final String customerName;
  final String status;
  final num totalAmount;

  factory SalesOrderRow.fromJson(Map<String, dynamic> json) {
    return SalesOrderRow(
      orderNumber: (json['order_number'] ?? 'Order').toString(),
      customerName: (json['customer_name'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      totalAmount: json['total_amount'] as num? ?? 0,
    );
  }
}
