int? _parseInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

class FinanceSummary {
  const FinanceSummary({
    this.revenue,
    this.expenses,
    this.netProfit,
    this.receivable,
    this.payables,
    this.overdueInvoices = 0,
  });

  static const FinanceSummary empty = FinanceSummary();

  final dynamic revenue;
  final dynamic expenses;
  final dynamic netProfit;
  final dynamic receivable;
  final dynamic payables;
  final int overdueInvoices;

  factory FinanceSummary.fromJson(Map<String, dynamic> json) {
    return FinanceSummary(
      revenue: json['revenue'],
      expenses: json['expenses'],
      netProfit: json['net_profit'],
      receivable: json['receivable'],
      payables: json['payables'],
      overdueInvoices: _parseInt(json['overdue_invoices']) ?? 0,
    );
  }
}

class PLReportRow {
  PLReportRow({
    required this.name,
    required this.type,
    required this.net,
  });

  final String name;
  final String type;
  final dynamic net;

  factory PLReportRow.fromJson(Map<String, dynamic> json) {
    return PLReportRow(
      name: (json['name'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      net: json['net'],
    );
  }
}

class GstInvoiceRow {
  GstInvoiceRow({
    required this.invoiceNumber,
    required this.invoiceDate,
    required this.status,
    required this.totalAmount,
  });

  final String invoiceNumber;
  final dynamic invoiceDate;
  final String status;
  final dynamic totalAmount;

  factory GstInvoiceRow.fromJson(Map<String, dynamic> json) {
    return GstInvoiceRow(
      invoiceNumber: (json['invoice_number'] ?? '').toString(),
      invoiceDate: json['invoice_date'],
      status: (json['status'] ?? '').toString(),
      totalAmount: json['total_amount'],
    );
  }
}

class GstTotals {
  const GstTotals({
    this.taxable,
    this.cgst,
    this.sgst,
    this.igst,
    this.totalTax,
    this.total,
  });

  static const GstTotals empty = GstTotals();

  final dynamic taxable;
  final dynamic cgst;
  final dynamic sgst;
  final dynamic igst;
  final dynamic totalTax;
  final dynamic total;

  factory GstTotals.fromJson(Map<String, dynamic> json) {
    return GstTotals(
      taxable: json['taxable'],
      cgst: json['cgst'],
      sgst: json['sgst'],
      igst: json['igst'],
      totalTax: json['total_tax'],
      total: json['total'],
    );
  }
}
