int? _parseInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

num _parseNum(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v;
  return num.tryParse(v.toString()) ?? 0;
}

class InventoryProduct {
  InventoryProduct({
    this.id,
    required this.name,
    required this.sku,
    required this.unit,
    required this.salePrice,
  });

  final int? id;
  final String name;
  final String sku;
  final String unit;
  final num salePrice;

  String get skuDisplay => sku.trim().isEmpty ? '—' : sku;

  factory InventoryProduct.fromJson(Map<String, dynamic> json) {
    return InventoryProduct(
      id: _parseInt(json['id']),
      name: (json['name'] ?? '').toString(),
      sku: (json['sku'] ?? '').toString(),
      unit: (json['unit'] ?? 'pcs').toString(),
      salePrice: _parseNum(json['sale_price']),
    );
  }
}

class InventoryWarehouse {
  InventoryWarehouse({
    required this.name,
    required this.location,
  });

  final String name;
  final String location;

  factory InventoryWarehouse.fromJson(Map<String, dynamic> json) {
    return InventoryWarehouse(
      name: (json['name'] ?? '').toString(),
      location: (json['location'] ?? '—').toString(),
    );
  }
}

class InventoryLowStockRow {
  InventoryLowStockRow({
    required this.name,
    required this.sku,
    required this.lowStockAlert,
    required this.totalStock,
  });

  final String name;
  final String sku;
  final num lowStockAlert;
  final num totalStock;

  String get skuDisplay => sku.trim().isEmpty ? '—' : sku;

  factory InventoryLowStockRow.fromJson(Map<String, dynamic> json) {
    return InventoryLowStockRow(
      name: (json['name'] ?? '').toString(),
      sku: (json['sku'] ?? '').toString(),
      lowStockAlert: _parseNum(json['low_stock_alert']),
      totalStock: _parseNum(json['total_stock']),
    );
  }
}

class StockMovementRow {
  StockMovementRow({
    required this.type,
    required this.productName,
    required this.warehouseName,
    required this.createdAt,
    required this.quantity,
  });

  final String type;
  final String productName;
  final String warehouseName;
  final dynamic createdAt;
  final num quantity;

  factory StockMovementRow.fromJson(Map<String, dynamic> json) {
    return StockMovementRow(
      type: (json['type'] ?? '').toString(),
      productName: (json['product_name'] ?? '').toString(),
      warehouseName: (json['warehouse_name'] ?? '').toString(),
      createdAt: json['created_at'],
      quantity: _parseNum(json['quantity']),
    );
  }
}
