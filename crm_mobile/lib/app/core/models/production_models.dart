int _workOrderId(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

num _parseNum(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v;
  return num.tryParse(v.toString()) ?? 0;
}

class BomListItem {
  BomListItem({
    required this.name,
    required this.productName,
    required this.version,
  });

  final String name;
  final String productName;
  final String version;

  factory BomListItem.fromJson(Map<String, dynamic> json) {
    return BomListItem(
      name: (json['name'] ?? 'BOM').toString(),
      productName: (json['product_name'] ?? '').toString(),
      version: (json['version'] ?? '1.0').toString(),
    );
  }
}

class WorkOrderRow {
  WorkOrderRow({
    required this.id,
    required this.woNumber,
    required this.productName,
    required this.quantity,
    required this.status,
  });

  final int id;
  final String woNumber;
  final String productName;
  final num quantity;
  final String status;

  factory WorkOrderRow.fromJson(Map<String, dynamic> json) {
    return WorkOrderRow(
      id: _workOrderId(json['id']),
      woNumber: (json['wo_number'] ?? 'WO').toString(),
      productName: (json['product_name'] ?? '').toString(),
      quantity: _parseNum(json['quantity']),
      status: (json['status'] ?? 'planned').toString(),
    );
  }
}
