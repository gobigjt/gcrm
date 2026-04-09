import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/utils/ui_format.dart' show formatIsoDate, parseDynamicNum;
import 'sales_document_kind.dart';

/// Client-side PDF for quotations, orders, and invoices (aligned with web invoice layout, simplified).
class SalesDocumentPdfBuilder {
  SalesDocumentPdfBuilder._();

  static String suggestedFileName({required Map<String, dynamic> doc, required SalesDocumentKind kind}) {
    var base = switch (kind) {
      SalesDocumentKind.quotation => (doc['quotation_number'] ?? 'QT-${doc['id']}').toString(),
      SalesDocumentKind.order => (doc['order_number'] ?? 'SO-${doc['id']}').toString(),
      SalesDocumentKind.invoice => (doc['invoice_number'] ?? 'INV-${doc['id']}').toString(),
    };
    base = base.replaceAll(RegExp(r'[<>:"/\\|?*\n\r\t]'), '_').trim();
    if (base.isEmpty) base = 'document-${doc['id']}';
    if (!base.toLowerCase().endsWith('.pdf')) {
      base = '$base.pdf';
    }
    return base;
  }

  static String _money(dynamic v) => parseDynamicNum(v).toStringAsFixed(2);

  static double _lineGst(Map<String, dynamic> it) {
    final base = parseDynamicNum(it['quantity']).toDouble() * parseDynamicNum(it['unit_price']).toDouble();
    final tot = parseDynamicNum(it['total']).toDouble();
    return (tot - base).clamp(0, double.infinity);
  }

  static (String, String) _lineTaxCells(
    Map<String, dynamic> it,
    bool interstate,
    bool isInvoice,
  ) {
    final hasSplit = isInvoice &&
        (parseDynamicNum(it['cgst']) > 0 ||
            parseDynamicNum(it['sgst']) > 0 ||
            parseDynamicNum(it['igst']) > 0);
    final rate = parseDynamicNum(it['gst_rate']).toDouble();
    if (hasSplit) {
      if (interstate) {
        final ig = parseDynamicNum(it['igst']).toDouble();
        final t1 = ig > 0 ? '${_money(ig)} (${rate.toStringAsFixed(0)}%)' : '—';
        return (t1, '—');
      }
      final half = rate / 2;
      final cg = parseDynamicNum(it['cgst']).toDouble();
      final sg = parseDynamicNum(it['sgst']).toDouble();
      return (
        cg > 0 ? '${_money(cg)} (${half.toStringAsFixed(1)}%)' : '—',
        sg > 0 ? '${_money(sg)} (${half.toStringAsFixed(1)}%)' : '—',
      );
    }
    final gstAmt = _lineGst(it);
    if (interstate) {
      return (
        gstAmt > 0 ? '${_money(gstAmt)} (${rate.toStringAsFixed(0)}%)' : '—',
        '—',
      );
    }
    final h = gstAmt / 2;
    final hr = rate / 2;
    return (
      h > 0 ? '${_money(h)} (${hr.toStringAsFixed(1)}%)' : '—',
      h > 0 ? '${_money(h)} (${hr.toStringAsFixed(1)}%)' : '—',
    );
  }

  static double _sumPayments(Map<String, dynamic> inv) {
    final pays = inv['payments'];
    if (pays is! List) return 0;
    var s = 0.0;
    for (final p in pays) {
      if (p is Map) {
        s += parseDynamicNum(p['amount']).toDouble();
      }
    }
    return s;
  }

  static String _bankBlock(Map<String, dynamic> co) {
    final lines = <String>[];
    lines.add((co['company_name'] ?? 'Company').toString());
    if ((co['bank_name'] ?? '').toString().trim().isNotEmpty) {
      lines.add('Bank Name: ${co['bank_name']}');
    }
    if ((co['bank_branch'] ?? '').toString().trim().isNotEmpty) {
      lines.add('Branch: ${co['bank_branch']}');
    }
    if ((co['bank_account_number'] ?? '').toString().trim().isNotEmpty) {
      lines.add('A/C No: ${co['bank_account_number']}');
    }
    if ((co['bank_ifsc'] ?? '').toString().trim().isNotEmpty) {
      lines.add('IFSC Code: ${co['bank_ifsc']}');
    }
    final extra = (co['invoice_bank_details'] ?? '').toString().trim();
    if (extra.isNotEmpty) lines.add(extra);
    return lines.join('\n');
  }

  static List<Map<String, dynamic>> _items(Map<String, dynamic> d) {
    final raw = d['items'];
    if (raw is! List) return [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  static Future<Uint8List> build({
    required Map<String, dynamic> doc,
    required Map<String, dynamic> company,
    required SalesDocumentKind kind,
  }) async {
    final items = _items(doc);
    final isInv = kind == SalesDocumentKind.invoice;
    final interstate = isInv && parseDynamicNum(doc['igst']) > 0;
    final title = switch (kind) {
      SalesDocumentKind.quotation => 'Quotation',
      SalesDocumentKind.order => 'Sales Order',
      SalesDocumentKind.invoice => 'Tax Invoice',
    };
    final docNo = switch (kind) {
      SalesDocumentKind.quotation => (doc['quotation_number'] ?? 'QT-${doc['id']}').toString(),
      SalesDocumentKind.order => (doc['order_number'] ?? 'SO-${doc['id']}').toString(),
      SalesDocumentKind.invoice => (doc['invoice_number'] ?? 'INV-${doc['id']}').toString(),
    };

    final taxHead1 = interstate ? 'IGST' : 'CGST';
    final taxHead2 = interstate ? '' : 'SGST';

    final tableRows = <pw.TableRow>[
      pw.TableRow(
        decoration: const pw.BoxDecoration(color: PdfColors.grey300),
        children: [
          _th('Description'),
          _th('SAC/HSN', center: true),
          _th('Price', right: true),
          _th('Qty', right: true),
          _th(taxHead1, right: true),
          _th(taxHead2, right: true),
          _th('SubTotal', right: true),
        ],
      ),
      ...items.map((it) {
        final desc = (it['description'] ?? it['product_name'] ?? '—').toString();
        final sac = (it['product_hsn_code'] ?? it['hsn_code'] ?? '—').toString();
        final (t1, t2) = _lineTaxCells(it, interstate, isInv);
        return pw.TableRow(
          children: [
            _td(desc),
            _td(sac, center: true),
            _td(_money(it['unit_price']), right: true),
            _td(parseDynamicNum(it['quantity']).toString(), right: true),
            _td(t1, right: true),
            _td(t2, right: true),
            _td(_money(it['total']), right: true, bold: true),
          ],
        );
      }),
    ];

    if (items.isEmpty) {
      tableRows.add(
        pw.TableRow(
          children: [
            _td('No line items'),
            ...List.generate(6, (_) => _td('—')),
          ],
        ),
      );
    }

    final pdf = pw.Document(
      title: docNo,
      author: (company['company_name'] ?? 'Company').toString(),
    );

    final coName = (company['company_name'] ?? 'Company').toString();
    final tagline = (company['invoice_tagline'] ?? '').toString().trim();
    final payTerms = (company['payment_terms'] ?? '').toString().trim();

    pdf.addPage(
      pw.MultiPage(
        maxPages: 100,
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (context) => [
          pw.Center(
            child: pw.Text(
              title.toUpperCase(),
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, letterSpacing: 1.2),
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Center(child: pw.Text(docNo, style: const pw.TextStyle(fontSize: 11))),
          if (tagline.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Center(
              child: pw.Text(tagline, style: const pw.TextStyle(fontSize: 8), textAlign: pw.TextAlign.center),
            ),
          ],
          pw.Divider(thickness: 0.8),
          pw.SizedBox(height: 8),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('To:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                    pw.SizedBox(height: 4),
                    pw.Text((doc['customer_name'] ?? '—').toString(),
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                    ..._customerLines(doc),
                  ],
                ),
              ),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: _metaLines(doc, kind),
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 12),
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey700, width: 0.4),
            columnWidths: {
              0: const pw.FlexColumnWidth(2.4),
              1: const pw.FlexColumnWidth(0.9),
              2: const pw.FlexColumnWidth(0.95),
              3: const pw.FlexColumnWidth(0.65),
              4: const pw.FlexColumnWidth(1.1),
              5: const pw.FlexColumnWidth(1.1),
              6: const pw.FlexColumnWidth(0.95),
            },
            children: tableRows,
          ),
          if ((doc['notes'] ?? '').toString().trim().isNotEmpty) ...[
            pw.SizedBox(height: 10),
            pw.Text('Notes', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.SizedBox(height: 2),
            pw.Text((doc['notes'] ?? '').toString(), style: const pw.TextStyle(fontSize: 8)),
          ],
          pw.SizedBox(height: 12),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('Thanks for your business.', style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontSize: 9)),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: _totalsWidgets(doc, kind, items, interstate),
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Text('For $coName', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
          if (payTerms.isNotEmpty) ...[
            pw.SizedBox(height: 12),
            pw.Text('Payment Terms', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.SizedBox(height: 4),
            pw.Text(payTerms, style: const pw.TextStyle(fontSize: 8)),
          ],
          pw.SizedBox(height: 12),
          pw.Text('OUR BANK DETAILS', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
          pw.SizedBox(height: 4),
          pw.Text(_bankBlock(company), style: const pw.TextStyle(fontSize: 8)),
          pw.SizedBox(height: 12),
          pw.Divider(color: PdfColors.grey400),
          pw.SizedBox(height: 6),
          pw.Text(
            _footerContact(company),
            style: const pw.TextStyle(fontSize: 8),
          ),
        ],
      ),
    );

    return pdf.save();
  }

  static List<pw.Widget> _customerLines(Map<String, dynamic> doc) {
    final w = <pw.Widget>[];
    final addr = (doc['customer_address'] ?? '').toString().trim();
    if (addr.isNotEmpty) w.add(pw.Text(addr, style: const pw.TextStyle(fontSize: 8)));
    final ph = (doc['customer_phone'] ?? '').toString().trim();
    if (ph.isNotEmpty) w.add(pw.Text('Phone: $ph', style: const pw.TextStyle(fontSize: 8)));
    final em = (doc['customer_email'] ?? '').toString().trim();
    if (em.isNotEmpty) w.add(pw.Text('Email: $em', style: const pw.TextStyle(fontSize: 8)));
    final gst = (doc['customer_gstin'] ?? '').toString().trim();
    if (gst.isNotEmpty) {
      w.add(pw.Text('GSTIN: $gst', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)));
    }
    return w;
  }

  static List<pw.Widget> _metaLines(Map<String, dynamic> doc, SalesDocumentKind kind) {
    final style = pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold);
    return switch (kind) {
      SalesDocumentKind.quotation => [
          pw.Text('SRN ${doc['id']}', style: style, textAlign: pw.TextAlign.right),
          pw.SizedBox(height: 3),
          if (formatIsoDate(doc['valid_until']) != '—')
            pw.Text('Valid Until ${formatIsoDate(doc['valid_until'])}', style: style, textAlign: pw.TextAlign.right)
          else
            pw.Text('Quote Date ${formatIsoDate(doc['created_at'])}', style: style, textAlign: pw.TextAlign.right),
          pw.SizedBox(height: 3),
          pw.Text('Quotation No. ${(doc['quotation_number'] ?? '').toString()}', style: style, textAlign: pw.TextAlign.right),
        ],
      SalesDocumentKind.order => [
          pw.Text('SRN ${doc['id']}', style: style, textAlign: pw.TextAlign.right),
          pw.SizedBox(height: 3),
          pw.Text(
            'Order Date ${formatIsoDate(doc['order_date'] ?? doc['created_at'])}',
            style: style,
            textAlign: pw.TextAlign.right,
          ),
          pw.SizedBox(height: 3),
          pw.Text('Order No. ${(doc['order_number'] ?? '').toString()}', style: style, textAlign: pw.TextAlign.right),
        ],
      SalesDocumentKind.invoice => [
          pw.Text('SRN ${doc['id']}', style: style, textAlign: pw.TextAlign.right),
          pw.SizedBox(height: 3),
          pw.Text(
            'Invoice Date ${formatIsoDate(doc['invoice_date'] ?? doc['created_at'])}',
            style: style,
            textAlign: pw.TextAlign.right,
          ),
          pw.SizedBox(height: 3),
          pw.Text('Due ${formatIsoDate(doc['due_date'])}', style: style, textAlign: pw.TextAlign.right),
          pw.SizedBox(height: 3),
          pw.Text('Invoice No. ${(doc['invoice_number'] ?? '').toString()}', style: style, textAlign: pw.TextAlign.right),
        ],
    };
  }

  static List<pw.Widget> _totalsWidgets(
    Map<String, dynamic> doc,
    SalesDocumentKind kind,
    List<Map<String, dynamic>> items,
    bool interstate,
  ) {
    final total = parseDynamicNum(doc['total_amount']).toDouble();
    final w = <pw.Widget>[];

    if (kind == SalesDocumentKind.invoice) {
      final sub = parseDynamicNum(doc['subtotal']).toDouble();
      final cgst = parseDynamicNum(doc['cgst']).toDouble();
      final sgst = parseDynamicNum(doc['sgst']).toDouble();
      final igst = parseDynamicNum(doc['igst']).toDouble();
      w.add(_sumRow('SubTotal:', _money(sub)));
      if (interstate) {
        w.add(_sumRow('Total IGST:', _money(igst)));
      } else {
        w.add(_sumRow('Total CGST + SGST:', _money(cgst + sgst)));
      }
      w.add(_sumRow('Total:', _money(total), bold: true));
      final bal = (total - _sumPayments(doc)).clamp(0, double.infinity);
      w.add(_sumRow('Balance Due:', _money(bal)));
      return w;
    }

    var taxable = 0.0;
    var gst = 0.0;
    for (final it in items) {
      taxable += parseDynamicNum(it['quantity']).toDouble() * parseDynamicNum(it['unit_price']).toDouble();
      gst += _lineGst(it);
    }
    w.add(_sumRow('Taxable value:', _money(taxable)));
    w.add(_sumRow('GST:', _money(gst)));
    w.add(_sumRow('Grand total:', _money(total), bold: true));
    return w;
  }

  static pw.Widget _sumRow(String label, String value, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 2),
      child: pw.Row(
        mainAxisSize: pw.MainAxisSize.min,
        children: [
          pw.SizedBox(
            width: 120,
            child: pw.Text(label, style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal), textAlign: pw.TextAlign.right),
          ),
          pw.SizedBox(width: 8),
          pw.Text(
            value,
            style: pw.TextStyle(
              fontSize: bold ? 11 : 9,
              fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  static String _footerContact(Map<String, dynamic> co) {
    final buf = StringBuffer('Contact: ${(co['address'] ?? '—').toString()}');
    final ph = (co['phone'] ?? '').toString().trim();
    if (ph.isNotEmpty) buf.write(' | (M) $ph');
    final em = (co['email'] ?? '').toString().trim();
    if (em.isNotEmpty) buf.write(' | $em');
    final gst = (co['gstin'] ?? '').toString().trim();
    if (gst.isNotEmpty) buf.write(' | GSTIN: $gst');
    return buf.toString();
  }

  static pw.Widget _th(String s, {bool center = false, bool right = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(4),
      child: pw.Text(
        s,
        style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold),
        textAlign: right
            ? pw.TextAlign.right
            : center
                ? pw.TextAlign.center
                : pw.TextAlign.left,
      ),
    );
  }

  static pw.Widget _td(
    String s, {
    bool center = false,
    bool right = false,
    bool bold = false,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(4),
      child: pw.Text(
        s,
        style: pw.TextStyle(fontSize: 7.5, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
        textAlign: right
            ? pw.TextAlign.right
            : center
                ? pw.TextAlign.center
                : pw.TextAlign.left,
      ),
    );
  }
}
