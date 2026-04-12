import 'package:flutter/material.dart';

import '../../core/utils/ui_format.dart';

/// Editable sales line (quotation, order, invoice). Totals match web `Sales.jsx` `calcLine`.
class SalesLineDraft {
  SalesLineDraft() {
    descCtrl    = TextEditingController();
    qtyCtrl     = TextEditingController(text: '1');
    unitCtrl    = TextEditingController(text: '0');
    discountCtrl = TextEditingController(text: '0');
    gstCtrl     = TextEditingController(text: '0');
  }

  late final TextEditingController descCtrl;
  late final TextEditingController qtyCtrl;
  late final TextEditingController unitCtrl;
  late final TextEditingController discountCtrl;
  late final TextEditingController gstCtrl;
  int? productId;

  void dispose() {
    descCtrl.dispose();
    qtyCtrl.dispose();
    unitCtrl.dispose();
    discountCtrl.dispose();
    gstCtrl.dispose();
  }

  double quantity()   => double.tryParse(qtyCtrl.text.trim())      ?? 0;
  double unitPrice()  => double.tryParse(unitCtrl.text.trim())      ?? 0;
  double discountAmt()=> double.tryParse(discountCtrl.text.trim())  ?? 0;
  double gstRate()    => double.tryParse(gstCtrl.text.trim())       ?? 0;

  /// Pre-tax value after per-line discount.
  /// For 'inclusive' taxType, back-calculates the taxable portion from the price.
  double taxableBase({String taxType = 'exclusive'}) {
    final b      = quantity() * unitPrice();
    final preTax = b - discountAmt();
    if (taxType == 'inclusive') {
      final rate = gstRate() / 100;
      return rate > 0 ? preTax / (1 + rate) : preTax;
    }
    return preTax; // exclusive or no_tax
  }

  double gstAmount({String taxType = 'exclusive'}) {
    if (taxType == 'no_tax') return 0;
    final rate   = gstRate() / 100;
    if (taxType == 'inclusive') {
      final preTax = quantity() * unitPrice() - discountAmt();
      final taxable = rate > 0 ? preTax / (1 + rate) : preTax;
      return double.parse((preTax - taxable).toStringAsFixed(2));
    }
    final g = taxableBase(taxType: taxType) * rate;
    return double.parse(g.toStringAsFixed(2));
  }

  double computedTotal({String taxType = 'exclusive'}) {
    if (taxType == 'no_tax') {
      return double.parse(taxableBase().toStringAsFixed(2));
    }
    if (taxType == 'inclusive') {
      // total = preTax (gst already embedded in unit_price)
      final preTax = quantity() * unitPrice() - discountAmt();
      return double.parse(preTax.toStringAsFixed(2));
    }
    final t = taxableBase() + gstAmount();
    return double.parse(t.toStringAsFixed(2));
  }

  /// Quotation / order line payload (matches web `DocumentModal` line submit).
  Map<String, dynamic> toPayload({
    String taxType = 'exclusive',
    bool interstate = false,
  }) =>
      toInvoiceLinePayload(interstate: interstate, taxType: taxType);

  /// Invoice API: per-line CGST/SGST/IGST split (matches web `DocumentModal` submit).
  Map<String, dynamic> toInvoiceLinePayload({
    required bool interstate,
    String taxType = 'exclusive',
  }) {
    final gst   = gstAmount(taxType: taxType);
    final total = computedTotal(taxType: taxType);
    final half  = gst / 2;
    final desc  = descCtrl.text.trim();
    return {
      'product_id': productId,
      'description': desc.isEmpty ? 'Item' : desc,
      'quantity': quantity(),
      'unit_price': unitPrice(),
      'discount': discountAmt(),
      'gst_rate': gstRate(),
      'cgst': interstate ? 0.0 : half,
      'sgst': interstate ? 0.0 : half,
      'igst': interstate ? gst : 0.0,
      'total': total,
    };
  }

  static SalesLineDraft fromApiRow(Map<String, dynamic> row) {
    final d = SalesLineDraft();
    d.descCtrl.text     = (row['description'] ?? '').toString();
    d.qtyCtrl.text      = parseDynamicNum(row['quantity']).toString();
    d.unitCtrl.text     = parseDynamicNum(row['unit_price']).toString();
    d.discountCtrl.text = parseDynamicNum(row['discount']).toString();
    d.gstCtrl.text      = parseDynamicNum(row['gst_rate']).toString();
    d.productId         = (row['product_id'] as num?)?.toInt();
    return d;
  }
}
