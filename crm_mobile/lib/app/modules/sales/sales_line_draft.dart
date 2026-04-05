import 'package:flutter/material.dart';

import '../../core/utils/ui_format.dart';

/// Editable sales line (quotation, order, invoice). Totals match web `Sales.jsx` `calcLine`.
class SalesLineDraft {
  SalesLineDraft() {
    descCtrl = TextEditingController();
    qtyCtrl = TextEditingController(text: '1');
    unitCtrl = TextEditingController(text: '0');
    gstCtrl = TextEditingController(text: '0');
  }

  late final TextEditingController descCtrl;
  late final TextEditingController qtyCtrl;
  late final TextEditingController unitCtrl;
  late final TextEditingController gstCtrl;
  int? productId;

  void dispose() {
    descCtrl.dispose();
    qtyCtrl.dispose();
    unitCtrl.dispose();
    gstCtrl.dispose();
  }

  double quantity() => double.tryParse(qtyCtrl.text.trim()) ?? 0;
  double unitPrice() => double.tryParse(unitCtrl.text.trim()) ?? 0;
  double gstRate() => double.tryParse(gstCtrl.text.trim()) ?? 0;

  double taxableBase() {
    final b = quantity() * unitPrice();
    return double.parse(b.toStringAsFixed(2));
  }

  double gstAmount() {
    final g = taxableBase() * gstRate() / 100;
    return double.parse(g.toStringAsFixed(2));
  }

  double computedTotal() {
    final t = taxableBase() + gstAmount();
    return double.parse(t.toStringAsFixed(2));
  }

  /// Quotation and sales order line payload.
  Map<String, dynamic> toPayload() {
    final desc = descCtrl.text.trim();
    return {
      'product_id': productId,
      'description': desc.isEmpty ? 'Item' : desc,
      'quantity': quantity(),
      'unit_price': unitPrice(),
      'gst_rate': gstRate(),
      'total': computedTotal(),
    };
  }

  /// Invoice API: per-line CGST/SGST/IGST split (matches web `DocumentModal` submit).
  Map<String, dynamic> toInvoiceLinePayload({required bool interstate}) {
    final gst = gstAmount();
    final total = computedTotal();
    final half = gst / 2;
    final desc = descCtrl.text.trim();
    return {
      'product_id': productId,
      'description': desc.isEmpty ? 'Item' : desc,
      'quantity': quantity(),
      'unit_price': unitPrice(),
      'gst_rate': gstRate(),
      'cgst': interstate ? 0.0 : half,
      'sgst': interstate ? 0.0 : half,
      'igst': interstate ? gst : 0.0,
      'total': total,
    };
  }

  static SalesLineDraft fromApiRow(Map<String, dynamic> row) {
    final d = SalesLineDraft();
    d.descCtrl.text = (row['description'] ?? '').toString();
    d.qtyCtrl.text = parseDynamicNum(row['quantity']).toString();
    d.unitCtrl.text = parseDynamicNum(row['unit_price']).toString();
    d.gstCtrl.text = parseDynamicNum(row['gst_rate']).toString();
    d.productId = (row['product_id'] as num?)?.toInt();
    return d;
  }
}
