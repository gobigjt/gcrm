import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart' show formatInrAmountDisplay, formatIsoDate, formatSalesCardDate, parseDynamicNum;
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import 'quotation_detail_controller.dart';

const Color _lightAppBarBg = Color(0xFF263238);
const Color _teal = Color(0xFF26A69A);

Color _appBarBg(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return Theme.of(context).brightness == Brightness.dark ? cs.surfaceContainerHigh : _lightAppBarBg;
}

Color _appBarFg(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? Theme.of(context).colorScheme.onSurface : Colors.white;

class QuotationDetailView extends StatelessWidget {
  const QuotationDetailView({super.key, required this.quotationId});

  final int quotationId;

  @override
  Widget build(BuildContext context) {
    if (quotationId <= 0) {
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
          child: Text('Invalid quotation.', style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        ),
      );
    }
    final c = Get.put(QuotationDetailController(quotationId: quotationId), tag: 'q-$quotationId');
    return Obx(() {
      if (c.isLoading.value && c.quotation.value == null) {
        final fg = _appBarFg(context);
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: _appBarBg(context),
            foregroundColor: fg,
            surfaceTintColor: Colors.transparent,
            iconTheme: IconThemeData(color: fg),
            leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
            title: const Text('Quotation'),
          ),
          body: Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary)),
        );
      }
      final q = c.quotation.value;
      if (q == null) {
        final fg = _appBarFg(context);
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: _appBarBg(context),
            foregroundColor: fg,
            surfaceTintColor: Colors.transparent,
            iconTheme: IconThemeData(color: fg),
            leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
            title: const Text('Quotation'),
          ),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: AppErrorBanner(message: c.errorMessage.value, onRetry: c.load),
          ),
        );
      }

      final items = QuotationDetailController.itemsOf(q);
      final grand = parseDynamicNum(q['total_amount']).toDouble();

      final fg = _appBarFg(context);
      final cs = Theme.of(context).colorScheme;
      final isDark = Theme.of(context).brightness == Brightness.dark;

      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: _appBarBg(context),
          foregroundColor: fg,
          surfaceTintColor: Colors.transparent,
          iconTheme: IconThemeData(color: fg),
          actionsIconTheme: IconThemeData(color: fg),
          leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded), color: fg),
          title: const Text('Quotation'),
          actions: [
            IconButton(
              onPressed: c.isSaving.value
                  ? null
                  : () async {
                      final r = await Get.toNamed(
                        AppRoutes.quotationForm,
                        arguments: {'quotationId': quotationId},
                      );
                      if (r == true) await c.load();
                    },
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
              'Quotation ${(q['quotation_number'] ?? '#${q['id']}').toString()}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: cs.onSurface,
                    fontSize: 17,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'for M/s.${QuotationDetailController.customerName(q)}',
              style: TextStyle(
                color: isDark ? cs.onSurfaceVariant : Colors.grey.shade700,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'Status:',
                  style: TextStyle(
                    color: isDark ? cs.onSurface : Colors.grey.shade800,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                _StatusChip(status: QuotationDetailController.statusOf(q)),
                PopupMenuButton<String>(
                  onSelected: c.isSaving.value ? null : c.setStatus,
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
                ),
              ],
            ),
            if (formatIsoDate(q['valid_until']) != '—') ...[
              const SizedBox(height: 8),
              Text(
                'Valid until ${formatSalesCardDate(q['valid_until'])}',
                style: TextStyle(
                  color: isDark ? cs.onSurfaceVariant : Colors.grey.shade600,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            if ((q['notes'] ?? '').toString().trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Notes',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurface,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                (q['notes'] ?? '').toString(),
                style: TextStyle(
                  height: 1.35,
                  fontSize: 14,
                  color: isDark ? cs.onSurface.withValues(alpha: 0.92) : Colors.grey.shade900,
                ),
              ),
            ],
            const SizedBox(height: 20),
            Text(
              'Line items',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: cs.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Card(
              color: isDark ? cs.surfaceContainer : Colors.white,
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
                          Expanded(flex: 3, child: Text('Product', style: _hdr(context))),
                          Expanded(child: Text('Qty × Price', textAlign: TextAlign.center, style: _hdr(context))),
                          Expanded(
                            flex: 2,
                            child: Text('Amount (INR)', textAlign: TextAlign.right, style: _hdr(context)),
                          ),
                        ],
                      ),
                    ),
                    Divider(height: 1, color: cs.outlineVariant.withValues(alpha: isDark ? 0.7 : 0.35)),
                    ...items.asMap().entries.map((e) {
                      final it = e.value;
                      final name = (it['product_name'] ?? it['description'] ?? '—').toString();
                      final desc = (it['description'] ?? '').toString();
                      final qty = parseDynamicNum(it['quantity']);
                      final up = parseDynamicNum(it['unit_price']);
                      final amt = QuotationDetailController.lineAmount(it);
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
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      color: cs.onSurface,
                                    ),
                                  ),
                                  if (desc.isNotEmpty && desc != name)
                                    Text(
                                      desc,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: isDark ? cs.onSurfaceVariant : Colors.grey.shade600,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Text(
                                '${up.toStringAsFixed(2)} ×\n${qty.toString()}',
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
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                  color: cs.onSurface,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              color: isDark ? cs.surfaceContainerHigh : Colors.white,
              elevation: isDark ? 0 : 1,
              shadowColor: isDark ? Colors.transparent : Colors.black26,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _totalRow(context, 'Sub total', grand, isDark: isDark),
                    _totalRow(context, 'Net total', grand, isDark: isDark),
                    Divider(height: 20, color: cs.outlineVariant.withValues(alpha: isDark ? 0.65 : 0.35)),
                    _totalRow(context, 'Grand total', grand, bold: true, isDark: isDark),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  TextStyle _hdr(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return TextStyle(
      fontSize: 11,
      color: dark ? cs.onSurfaceVariant : Colors.grey.shade600,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.3,
    );
  }

  Widget _totalRow(BuildContext context, String label, double value, {bool bold = false, required bool isDark}) {
    final cs = Theme.of(context).colorScheme;
    final labelColor = bold
        ? cs.onSurface
        : (isDark ? cs.onSurfaceVariant : Colors.grey.shade800);
    final valueColor = bold ? _teal : (isDark ? cs.onSurface : Colors.grey.shade900);
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
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    Color bg;
    Color fg;
    switch (status) {
      case 'accepted':
        bg = dark ? const Color(0xFF0D3D32) : const Color(0xFFE1F5EE);
        fg = dark ? const Color(0xFF6EE7C5) : const Color(0xFF085041);
        break;
      case 'rejected':
        bg = dark ? const Color(0xFF3D1518) : const Color(0xFFFCEBEB);
        fg = dark ? const Color(0xFFFDA4AF) : const Color(0xFF791F1F);
        break;
      case 'sent':
        bg = dark ? const Color(0xFF1A2F4A) : const Color(0xFFE6F1FB);
        fg = dark ? const Color(0xFF93C5FD) : const Color(0xFF0C447C);
        break;
      default:
        bg = dark ? const Color(0xFF2A3444) : Colors.grey.shade200;
        fg = dark ? const Color(0xFFE2E8F0) : Colors.grey.shade800;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}
