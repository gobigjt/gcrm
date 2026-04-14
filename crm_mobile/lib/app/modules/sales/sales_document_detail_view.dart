import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart'
    show formatInrAmountDisplay, formatIsoDate, formatSalesCardDate, parseDynamicNum;
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../auth/auth_controller.dart';
import 'sales_document_detail_controller.dart';
import 'sales_document_kind.dart';
import 'sales_document_pdf_service.dart';

const Color _lightAppBarBg = Color(0xFF263238);
const Color _teal = Color(0xFF26A69A);

Color _appBarBg(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return Theme.of(context).brightness == Brightness.dark ? cs.surfaceContainerHigh : _lightAppBarBg;
}

Color _appBarFg(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? Theme.of(context).colorScheme.onSurface : Colors.white;

String _titleForKind(SalesDocumentKind k) {
  return switch (k) {
    SalesDocumentKind.quotation => 'Quotation',
    SalesDocumentKind.order => 'Sales order',
    SalesDocumentKind.invoice => 'Invoice',
  };
}

String _numberLabel(Map<String, dynamic> d, SalesDocumentKind k) {
  return switch (k) {
    SalesDocumentKind.quotation => (d['quotation_number'] ?? '#${d['id']}').toString(),
    SalesDocumentKind.order => (d['order_number'] ?? '#${d['id']}').toString(),
    SalesDocumentKind.invoice => (d['invoice_number'] ?? '#${d['id']}').toString(),
  };
}

class SalesDocumentDetailView extends StatefulWidget {
  const SalesDocumentDetailView({super.key, required this.kind, required this.documentId});

  final SalesDocumentKind kind;
  final int documentId;

  @override
  State<SalesDocumentDetailView> createState() => _SalesDocumentDetailViewState();
}

class _SalesDocumentDetailViewState extends State<SalesDocumentDetailView> {
  late final String _tag;
  late final SalesDocumentDetailController c;
  bool _pdfBusy = false;

  @override
  void initState() {
    super.initState();
    _tag = 'sd_${widget.kind.name}_${widget.documentId}';
    c = Get.put(
      SalesDocumentDetailController(kind: widget.kind, documentId: widget.documentId),
      tag: _tag,
    );
  }

  @override
  void dispose() {
    Get.delete<SalesDocumentDetailController>(tag: _tag);
    super.dispose();
  }

  Future<void> _downloadPdf(Map<String, dynamic> doc) async {
    if (_pdfBusy) return;
    setState(() => _pdfBusy = true);
    try {
      final auth = Get.find<AuthController>();
      await SalesDocumentPdfService.download(auth: auth, doc: doc, kind: widget.kind);
      if (mounted) {
        Get.snackbar('PDF', 'Ready — check downloads or the share sheet.');
      }
    } catch (e) {
      Get.snackbar('PDF failed', e.toString());
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  Future<void> _onEditPressed() async {
    if (widget.kind == SalesDocumentKind.quotation) {
      final r = await Get.toNamed(
        AppRoutes.quotationForm,
        arguments: {'quotationId': widget.documentId},
      );
      if (r == true) await c.load();
      return;
    }
    if (widget.kind == SalesDocumentKind.invoice) {
      final r = await Get.toNamed(
        AppRoutes.invoiceForm,
        arguments: {'invoiceId': widget.documentId},
      );
      if (r == true) await c.load();
      return;
    }
    if (widget.kind == SalesDocumentKind.order) {
      final r = await Get.toNamed(
        AppRoutes.orderForm,
        arguments: {'orderId': widget.documentId},
      );
      if (r == true) await c.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.documentId <= 0) {
      final fg = _appBarFg(context);
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: _appBarBg(context),
          foregroundColor: fg,
          surfaceTintColor: Colors.transparent,
          iconTheme: IconThemeData(color: fg),
          leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
        ),
        body: Center(
          child: Text('Invalid document.', style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        ),
      );
    }

    return Obx(() {
      if (c.isLoading.value && c.document.value == null) {
        final fg = _appBarFg(context);
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: _appBarBg(context),
            foregroundColor: fg,
            surfaceTintColor: Colors.transparent,
            iconTheme: IconThemeData(color: fg),
            leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
            title: Text(_titleForKind(widget.kind)),
          ),
          body: Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary)),
        );
      }

      final d = c.document.value;
      if (d == null) {
        final fg = _appBarFg(context);
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: _appBarBg(context),
            foregroundColor: fg,
            surfaceTintColor: Colors.transparent,
            iconTheme: IconThemeData(color: fg),
            leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
            title: Text(_titleForKind(widget.kind)),
          ),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: AppErrorBanner(message: c.errorMessage.value, onRetry: c.load),
          ),
        );
      }

      final items = SalesDocumentDetailController.itemsOf(d);
      final fg = _appBarFg(context);
      final cs = Theme.of(context).colorScheme;
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final canEdit = widget.kind == SalesDocumentKind.quotation ||
          widget.kind == SalesDocumentKind.invoice ||
          widget.kind == SalesDocumentKind.order;
      final saving = c.isSaving.value;

      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: _appBarBg(context),
          foregroundColor: fg,
          surfaceTintColor: Colors.transparent,
          iconTheme: IconThemeData(color: fg),
          actionsIconTheme: IconThemeData(color: fg),
          leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded), color: fg),
          title: Text(_titleForKind(widget.kind)),
          actions: [
            IconButton(
              tooltip: 'Download PDF',
              onPressed: _pdfBusy ? null : () => _downloadPdf(d),
              icon: _pdfBusy
                  ? SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                    )
                  : const Icon(Icons.picture_as_pdf_outlined),
              color: fg,
            ),
            if (canEdit)
              IconButton(
                onPressed: saving ? null : _onEditPressed,
                icon: const Icon(Icons.edit_outlined),
                color: fg,
                tooltip: 'Edit',
              ),
            IconButton(onPressed: c.load, icon: const Icon(Icons.refresh_rounded), color: fg),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
          children: [
            if (c.errorMessage.value.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppErrorBanner(message: c.errorMessage.value, onRetry: c.load),
              ),
            Text(
              '${_titleForKind(widget.kind)} ${_numberLabel(d, widget.kind)}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: cs.onSurface,
                    fontSize: 17,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'for M/s.${SalesDocumentDetailController.customerName(d)}',
              style: TextStyle(
                color: isDark ? cs.onSurfaceVariant : Colors.grey.shade700,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 12),
            _customerBlock(d, isDark, cs),
            const SizedBox(height: 12),
            _statusAndMeta(c, widget.kind, d, isDark, cs),
            if ((d['notes'] ?? '').toString().trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Notes', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: cs.onSurface)),
              const SizedBox(height: 4),
              Text(
                (d['notes'] ?? '').toString(),
                style: TextStyle(
                  height: 1.35,
                  fontSize: 14,
                  color: isDark ? cs.onSurface.withValues(alpha: 0.92) : Colors.grey.shade900,
                ),
              ),
            ],
            const SizedBox(height: 20),
            Text('Line items', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: cs.onSurface)),
            const SizedBox(height: 8),
            _lineItemsCard(context, items, isDark, cs),
            const SizedBox(height: 12),
            _totalsCard(d, widget.kind, items, isDark, cs),
            if (widget.kind == SalesDocumentKind.invoice) _paymentsSection(d, isDark, cs),
          ],
        ),
      );
    });
  }
}

Widget _customerBlock(Map<String, dynamic> d, bool isDark, ColorScheme cs) {
  final addr = (d['customer_address'] ?? '').toString().trim();
  final phone = (d['customer_phone'] ?? '').toString().trim();
  final email = (d['customer_email'] ?? '').toString().trim();
  final gst = (d['customer_gstin'] ?? '').toString().trim();
  if (addr.isEmpty && phone.isEmpty && email.isEmpty && gst.isEmpty) {
    return const SizedBox.shrink();
  }
  return Card(
    color: cs.surfaceContainer,
    elevation: isDark ? 0 : 1,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade200),
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bill to', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: cs.onSurface)),
          if (addr.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(addr, style: TextStyle(fontSize: 13, height: 1.35, color: cs.onSurface.withValues(alpha: 0.9))),
          ],
          if (phone.isNotEmpty)
            Text('Phone: $phone', style: TextStyle(fontSize: 12, color: isDark ? cs.onSurfaceVariant : Colors.grey.shade700)),
          if (email.isNotEmpty)
            Text('Email: $email', style: TextStyle(fontSize: 12, color: isDark ? cs.onSurfaceVariant : Colors.grey.shade700)),
          if (gst.isNotEmpty)
            Text('GSTIN: $gst', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cs.onSurface)),
        ],
      ),
    ),
  );
}

Widget _statusAndMeta(
  SalesDocumentDetailController c,
  SalesDocumentKind kind,
  Map<String, dynamic> d,
  bool isDark,
  ColorScheme cs,
) {
  final status = SalesDocumentDetailController.statusOf(d, kind);
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('Status:', style: TextStyle(color: isDark ? cs.onSurface : Colors.grey.shade800, fontWeight: FontWeight.w600)),
          _statusChip(kind, status, isDark),
          if (kind == SalesDocumentKind.quotation)
            Obx(() {
              final saving = c.isSaving.value;
              return PopupMenuButton<String>(
                onSelected: saving ? null : c.setQuotationStatus,
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'draft', child: Text('Draft')),
                  PopupMenuItem(value: 'sent', child: Text('Sent')),
                  PopupMenuItem(value: 'accepted', child: Text('Accepted')),
                  PopupMenuItem(value: 'rejected', child: Text('Rejected')),
                ],
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Change', style: TextStyle(color: _teal, fontWeight: FontWeight.w600)),
                      Icon(Icons.arrow_drop_down, color: _teal),
                    ],
                  ),
                ),
              );
            }),
          if (kind == SalesDocumentKind.order)
            Obx(() {
              final saving = c.isSaving.value;
              return PopupMenuButton<String>(
                onSelected: saving ? null : c.setOrderStatus,
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'pending', child: Text('Pending')),
                  PopupMenuItem(value: 'processing', child: Text('Processing')),
                  PopupMenuItem(value: 'shipped', child: Text('Shipped')),
                  PopupMenuItem(value: 'delivered', child: Text('Delivered')),
                  PopupMenuItem(value: 'cancelled', child: Text('Cancelled')),
                ],
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Change', style: TextStyle(color: _teal, fontWeight: FontWeight.w600)),
                      Icon(Icons.arrow_drop_down, color: _teal),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
      const SizedBox(height: 8),
      ..._metaTextLines(kind, d, isDark, cs),
    ],
  );
}

List<Widget> _metaTextLines(SalesDocumentKind kind, Map<String, dynamic> d, bool isDark, ColorScheme cs) {
  final style = TextStyle(
    color: isDark ? cs.onSurfaceVariant : Colors.grey.shade600,
    fontSize: 13,
    fontWeight: FontWeight.w500,
  );
  switch (kind) {
    case SalesDocumentKind.quotation:
      final lines = <Widget>[];
      if (formatIsoDate(d['valid_until']) != '—') {
        lines.add(Text('Valid until ${formatSalesCardDate(d['valid_until'])}', style: style));
      } else {
        lines.add(Text('Quote date ${formatSalesCardDate(d['created_at'])}', style: style));
      }
      return lines;
    case SalesDocumentKind.order:
      return [
        Text('Order date ${formatSalesCardDate(d['order_date'] ?? d['created_at'])}', style: style),
      ];
    case SalesDocumentKind.invoice:
      return [
        Text('Invoice date ${formatSalesCardDate(d['invoice_date'] ?? d['created_at'])}', style: style),
        Text('Due ${formatSalesCardDate(d['due_date'])}', style: style),
      ];
  }
}

Widget _statusChip(SalesDocumentKind kind, String status, bool isDark) {
  if (kind == SalesDocumentKind.invoice) {
    return _InvoiceStatusChip(status: status, isDark: isDark);
  }
  if (kind == SalesDocumentKind.order) {
    return _OrderStatusChip(status: status, isDark: isDark);
  }
  return _QuoteStatusChip(status: status, isDark: isDark);
}

class _QuoteStatusChip extends StatelessWidget {
  const _QuoteStatusChip({required this.status, required this.isDark});

  final String status;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'accepted':
        bg = isDark ? const Color(0xFF0D3D32) : const Color(0xFFE1F5EE);
        fg = isDark ? const Color(0xFF6EE7C5) : const Color(0xFF085041);
        break;
      case 'rejected':
        bg = isDark ? const Color(0xFF3D1518) : const Color(0xFFFCEBEB);
        fg = isDark ? const Color(0xFFFDA4AF) : const Color(0xFF791F1F);
        break;
      case 'sent':
        bg = isDark ? const Color(0xFF1A2F4A) : const Color(0xFFE6F1FB);
        fg = isDark ? const Color(0xFF93C5FD) : const Color(0xFF0C447C);
        break;
      default:
        bg = isDark ? const Color(0xFF2A3444) : Colors.grey.shade200;
        fg = isDark ? const Color(0xFFE2E8F0) : Colors.grey.shade800;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}

class _OrderStatusChip extends StatelessWidget {
  const _OrderStatusChip({required this.status, required this.isDark});

  final String status;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'delivered':
        bg = isDark ? const Color(0xFF0D3D32) : const Color(0xFFE1F5EE);
        fg = isDark ? const Color(0xFF6EE7C5) : const Color(0xFF085041);
        break;
      case 'cancelled':
        bg = isDark ? const Color(0xFF3D1518) : const Color(0xFFFCEBEB);
        fg = isDark ? const Color(0xFFFDA4AF) : const Color(0xFF791F1F);
        break;
      case 'shipped':
      case 'processing':
        bg = isDark ? const Color(0xFF1A2F4A) : const Color(0xFFE6F1FB);
        fg = isDark ? const Color(0xFF93C5FD) : const Color(0xFF0C447C);
        break;
      default:
        bg = isDark ? const Color(0xFF2A3444) : Colors.grey.shade200;
        fg = isDark ? const Color(0xFFE2E8F0) : Colors.grey.shade800;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}

class _InvoiceStatusChip extends StatelessWidget {
  const _InvoiceStatusChip({required this.status, required this.isDark});

  final String status;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'paid':
        bg = isDark ? const Color(0xFF0D3D32) : const Color(0xFFE1F5EE);
        fg = isDark ? const Color(0xFF6EE7C5) : const Color(0xFF085041);
        break;
      case 'partial':
        bg = isDark ? const Color(0xFF3D3310) : const Color(0xFFFFF8E1);
        fg = isDark ? const Color(0xFFFFE082) : const Color(0xFF795548);
        break;
      default:
        bg = isDark ? const Color(0xFF3D1518) : const Color(0xFFFCEBEB);
        fg = isDark ? const Color(0xFFFDA4AF) : const Color(0xFF791F1F);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}

TextStyle _lineHdr(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  return TextStyle(
    fontSize: 11,
    color: dark ? cs.onSurfaceVariant : Colors.grey.shade600,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.3,
  );
}

Widget _lineItemsCard(BuildContext context, List<Map<String, dynamic>> items, bool isDark, ColorScheme cs) {
  return Card(
    color: cs.surfaceContainer,
    elevation: isDark ? 0 : 1,
    shadowColor: isDark ? Colors.transparent : Colors.black26,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade200),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                Expanded(flex: 3, child: Text('Product', style: _lineHdr(context))),
                Expanded(child: Text('Qty x Price', textAlign: TextAlign.center, style: _lineHdr(context))),
                Expanded(
                  flex: 2,
                  child: Text('Amount (₹)', textAlign: TextAlign.right, style: _lineHdr(context)),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: cs.outlineVariant.withValues(alpha: isDark ? 0.7 : 0.35)),
          ...items.map((it) {
            final name = (it['product_name'] ?? it['description'] ?? '—').toString();
            final desc = (it['description'] ?? '').toString();
            final qty = parseDynamicNum(it['quantity']);
            final up = parseDynamicNum(it['unit_price']);
            final amt = SalesDocumentDetailController.lineAmount(it);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: cs.onSurface),
                        ),
                        if (desc.isNotEmpty && desc != name)
                          Text(
                            desc,
                            style: TextStyle(fontSize: 12, color: isDark ? cs.onSurfaceVariant : Colors.grey.shade600),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '${up.toStringAsFixed(2)} x\n${qty.toString()}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.3,
                        color: cs.onSurface.withValues(alpha: isDark ? 0.95 : 0.9),
                      ),
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(
                      formatInrAmountDisplay(amt),
                      textAlign: TextAlign.right,
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: cs.onSurface),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    ),
  );
}

Widget _totalsCard(Map<String, dynamic> d, SalesDocumentKind kind, List<Map<String, dynamic>> items, bool isDark, ColorScheme cs) {
  final total = parseDynamicNum(d['total_amount']).toDouble();

  if (kind == SalesDocumentKind.invoice) {
    final sub = parseDynamicNum(d['subtotal']).toDouble();
    final cgst = parseDynamicNum(d['cgst']).toDouble();
    final sgst = parseDynamicNum(d['sgst']).toDouble();
    final igst = parseDynamicNum(d['igst']).toDouble();
    final paid = SalesDocumentDetailController.sumPayments(d);
    final balance = (total - paid).clamp(0.0, double.infinity);
    final interstate = igst > 0;
    return Card(
      color: cs.surfaceContainerHigh,
      elevation: isDark ? 0 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _totRow(cs, isDark, 'Subtotal', sub, bold: false),
            if (interstate)
              _totRow(cs, isDark, 'IGST', igst, bold: false)
            else ...[
              _totRow(cs, isDark, 'CGST', cgst, bold: false),
              _totRow(cs, isDark, 'SGST', sgst, bold: false),
            ],
            Divider(height: 20, color: cs.outlineVariant.withValues(alpha: isDark ? 0.65 : 0.35)),
            _totRow(cs, isDark, 'Total', total, bold: true),
            _totRow(cs, isDark, 'Balance due', balance, bold: false, accent: true),
          ],
        ),
      ),
    );
  }

  final taxable = SalesDocumentDetailController.taxableFromItems(items);
  final gst = SalesDocumentDetailController.gstFromItems(items);
  return Card(
    color: cs.surfaceContainerHigh,
    elevation: isDark ? 0 : 1,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade200),
    ),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _totRow(cs, isDark, 'Taxable value', taxable, bold: false),
          _totRow(cs, isDark, 'GST', gst, bold: false),
          Divider(height: 20, color: cs.outlineVariant.withValues(alpha: isDark ? 0.65 : 0.35)),
          _totRow(cs, isDark, 'Grand total', total, bold: true),
        ],
      ),
    ),
  );
}

Widget _totRow(ColorScheme cs, bool isDark, String label, double value, {required bool bold, bool accent = false}) {
  final labelColor = bold ? cs.onSurface : (isDark ? cs.onSurfaceVariant : Colors.grey.shade800);
  final valueColor = accent
      ? _teal
      : bold
          ? _teal
          : (isDark ? cs.onSurface : Colors.grey.shade900);
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
            color: labelColor,
            fontSize: bold ? 15 : 14,
          ),
        ),
        Text(
          formatInrAmountDisplay(value),
          style: TextStyle(
            fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
            fontSize: bold ? 16 : 14,
            color: valueColor,
          ),
        ),
      ],
    ),
  );
}

Widget _paymentsSection(Map<String, dynamic> d, bool isDark, ColorScheme cs) {
  final pays = d['payments'];
  if (pays is! List || pays.isEmpty) return const SizedBox.shrink();
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SizedBox(height: 16),
      Text('Payments', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: cs.onSurface)),
      const SizedBox(height: 8),
      Card(
        color: cs.surfaceContainer,
        elevation: isDark ? 0 : 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade200),
        ),
        child: Column(
          children: [
            for (final raw in pays)
              if (raw is Map)
                ListTile(
                  title: Text(
                    formatInrAmountDisplay(parseDynamicNum(raw['amount'])),
                    style: TextStyle(fontWeight: FontWeight.w700, color: cs.onSurface),
                  ),
                  subtitle: Text(
                    '${formatSalesCardDate(raw['payment_date'])} · ${(raw['method'] ?? '—').toString()}',
                    style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                  ),
                ),
          ],
        ),
      ),
    ],
  );
}
