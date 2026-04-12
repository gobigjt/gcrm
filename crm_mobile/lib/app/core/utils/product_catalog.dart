import 'ui_format.dart';

/// Sum of warehouse quantities from inventory API (`total_stock` on list rows).
double productTotalStock(Map<String, dynamic> product) {
  final v = product['total_stock'] ?? product['stock'] ?? product['quantity'] ?? 0;
  return parseDynamicNum(v).toDouble();
}

/// Only products with on-hand quantity greater than zero (sales document pickers).
List<Map<String, dynamic>> productsWithAvailableStock(List<Map<String, dynamic>> raw) {
  return raw.where((p) => productTotalStock(p) > 0).toList();
}

String productPickerSubtitle(Map<String, dynamic> p) {
  final stock = productTotalStock(p);
  final stockLabel = stock == stock.roundToDouble() ? stock.round().toString() : stock.toStringAsFixed(2);
  final sale = p['sale_price'];
  final gst = p['gst_rate'] ?? 0;
  return 'Stock $stockLabel · Sale $sale · GST $gst%';
}
