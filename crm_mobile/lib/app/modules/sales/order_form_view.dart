import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart' show pickDateIntoController;
import '../../shared/widgets/app_error_banner.dart';
import '../auth/auth_controller.dart';
import 'order_form_controller.dart';
import 'sales_document_form_ui.dart';
import 'sales_form_layout_widgets.dart';

class OrderFormView extends StatefulWidget {
  const OrderFormView({super.key, this.initialCustomerId});

  final int? initialCustomerId;

  @override
  State<OrderFormView> createState() => _OrderFormViewState();
}

class _OrderFormViewState extends State<OrderFormView> {
  late final String _tag;
  late final OrderFormController c;

  @override
  void initState() {
    super.initState();
    _tag = 'of_${identityHashCode(this)}';
    c = Get.put(OrderFormController(initialCustomerId: widget.initialCustomerId), tag: _tag);
  }

  @override
  void dispose() {
    Get.delete<OrderFormController>(tag: _tag);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const title = 'New Sales Order';
    final pageBg = Theme.of(context).scaffoldBackgroundColor;

    return Obx(() {
      if (c.isLoading.value) {
        return Scaffold(
          backgroundColor: pageBg,
          appBar: salesDocAppBar(context, title: title, showSave: false, isSaving: false, onSave: null),
          body: Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary)),
        );
      }

      return Scaffold(
        backgroundColor: pageBg,
        appBar: salesDocAppBar(
          context,
          title: title,
          showSave: true,
          isSaving: c.isSaving.value,
          onSave: c.isSaving.value ? null : c.submit,
        ),
        body: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
                children: [
                  if (c.errorMessage.value.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AppErrorBanner(message: c.errorMessage.value, onRetry: c.retry),
                    ),

                  Builder(builder: (context) {
                    final auth = Get.find<AuthController>();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SalesFormSectionCard(
                          title: 'Bill To',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Obx(() {
                                String? name;
                                final sid = c.selectedCustomerId.value;
                                if (sid != null) {
                                  for (final cu in c.customers) {
                                    if ((cu['id'] as num?)?.toInt() == sid) {
                                      name = (cu['name'] ?? '').toString();
                                      break;
                                    }
                                  }
                                }
                                final hint = (name == null || name.isEmpty) ? 'Select customer' : 'for M/s. $name';
                                final cs2 = Theme.of(context).colorScheme;
                                return Text(
                                  hint,
                                  style: TextStyle(
                                    color: Theme.of(context).brightness == Brightness.dark
                                        ? cs2.onSurfaceVariant
                                        : Colors.grey.shade900,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                );
                              }),
                              const SizedBox(height: 12),
                              SalesBillToFields(
                                auth: auth,
                                customers: c.customers,
                                selectedCustomerId: c.selectedCustomerId,
                                executives: c.executives,
                                selectedCreatedById: c.selectedCreatedById,
                                customerDecoration: (ctx) => salesCustomerDropdownDecoration(
                                  ctx,
                                  hint: Text(
                                    'Choose customer',
                                    style: TextStyle(
                                      color: Theme.of(ctx).brightness == Brightness.dark
                                          ? Theme.of(ctx).colorScheme.onSurfaceVariant
                                          : const Color(0xFF475569),
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                                onCustomerChanged: (v) => c.selectedCustomerId.value = v,
                                onExecutiveChanged: (v) => c.selectedCreatedById.value = v,
                                sectionLabelStyle: salesFieldSectionLabel,
                              ),
                            ],
                          ),
                        ),
                        SalesFormSectionCard(
                          title: 'Order properties',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text('Order date', style: salesFieldSectionLabel(context)),
                              const SizedBox(height: 6),
                              TextField(
                                controller: c.orderDateCtrl,
                                readOnly: true,
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                decoration: salesOutlineField(
                                  context,
                                  hintText: 'Tap calendar to pick a date',
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.calendar_today_rounded,
                                      color: Theme.of(context).brightness == Brightness.dark
                                          ? Theme.of(context).colorScheme.onSurfaceVariant
                                          : Colors.grey.shade700,
                                    ),
                                    onPressed: () =>
                                        pickDateIntoController(context: context, controller: c.orderDateCtrl),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text('Due date', style: salesFieldSectionLabel(context)),
                              const SizedBox(height: 6),
                              TextField(
                                controller: c.dueDateCtrl,
                                readOnly: true,
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                decoration: salesOutlineField(
                                  context,
                                  hintText: 'Tap calendar to pick a date',
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.event_rounded,
                                      color: Theme.of(context).brightness == Brightness.dark
                                          ? Theme.of(context).colorScheme.onSurfaceVariant
                                          : Colors.grey.shade700,
                                    ),
                                    onPressed: () =>
                                        pickDateIntoController(context: context, controller: c.dueDateCtrl),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text('Reference No.', style: salesFieldSectionLabel(context)),
                              const SizedBox(height: 6),
                              TextField(
                                controller: c.referenceNoCtrl,
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                decoration: salesOutlineField(context, hintText: 'Optional reference number'),
                              ),
                              const SizedBox(height: 12),
                              Text('Status', style: salesFieldSectionLabel(context)),
                              const SizedBox(height: 6),
                              Obx(() {
                                const opts = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
                                final cur =
                                    opts.contains(c.orderStatusValue.value) ? c.orderStatusValue.value : 'pending';
                                return DropdownButtonFormField<String>(
                                  value: cur,
                                  decoration: salesCustomerDropdownDecoration(context, hint: const Text('Status')),
                                  dropdownColor: Theme.of(context).brightness == Brightness.dark
                                      ? Theme.of(context).colorScheme.surfaceContainerHighest
                                      : null,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  items: opts
                                      .map(
                                        (s) => DropdownMenuItem<String>(
                                          value: s,
                                          child: Text(s[0].toUpperCase() + s.substring(1)),
                                        ),
                                      )
                                      .toList(),
                                  onChanged: (v) {
                                    if (v != null) c.orderStatusValue.value = v;
                                  },
                                );
                              }),
                              const SizedBox(height: 12),
                              Obx(() => salesRadioGroup(
                                    context: context,
                                    label: 'GST TYPE',
                                    options: const [
                                      ('intra_state', 'Intra State (CGST+SGST)'),
                                      ('inter_state', 'Inter State (IGST)'),
                                    ],
                                    selected: c.gstTypeValue.value,
                                    onChanged: (v) {
                                      c.gstTypeValue.value = v;
                                      c.lines.refresh();
                                    },
                                  )),
                              const SizedBox(height: 12),
                              Obx(() => salesRadioGroup(
                                    context: context,
                                    label: 'TAX',
                                    options: const [
                                      ('exclusive', 'Tax Exclusive'),
                                      ('inclusive', 'Tax Inclusive'),
                                      ('no_tax', 'No Tax'),
                                    ],
                                    selected: c.taxTypeValue.value,
                                    onChanged: (v) {
                                      c.taxTypeValue.value = v;
                                      c.lines.refresh();
                                    },
                                  )),
                              const SizedBox(height: 12),
                              Text('Notes', style: salesFieldSectionLabel(context)),
                              const SizedBox(height: 6),
                              TextField(
                                controller: c.notesCtrl,
                                maxLines: 3,
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                decoration: salesOutlineField(context, hintText: 'Optional notes for this order'),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  }),

                  SalesFormSectionCard(
                    title: 'Items',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Text('Line items', style: salesFieldSectionLabel(context)),
                            const Spacer(),
                            Text(
                              'Qty · Price · Disc · GST',
                              style: TextStyle(
                                fontSize: 10,
                                color: Theme.of(context).brightness == Brightness.dark
                                    ? Theme.of(context).colorScheme.onSurfaceVariant
                                    : Colors.grey.shade800,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Obx(() {
                    final tt = c.taxTypeValue.value;
                    return Column(
                      children: List.generate(c.lines.length, (i) {
                        final line   = c.lines[i];
                        final cs2    = Theme.of(context).colorScheme;
                        final isDark = Theme.of(context).brightness == Brightness.dark;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          color: cs2.surfaceContainer,
                          elevation: isDark ? 0 : 1.5,
                          shadowColor: isDark ? Colors.transparent : Colors.black26,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(color: isDark ? cs2.outlineVariant : Colors.grey.shade300),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                                        Text('Description', style: salesLineItemCaption(context)),
                                        const SizedBox(height: 4),
                                        TextField(
                                          controller: line.descCtrl,
                                          style: TextStyle(color: cs2.onSurface, fontSize: 15),
                                          decoration: salesOutlineField(context, hintText: 'Product or description'),
                                          onChanged: (_) => c.lines.refresh(),
                                        ),
                                      ]),
                                    ),
                                    IconButton(
                                      onPressed: () => c.removeLineAt(i),
                                      icon: const Icon(Icons.delete_outline, color: Color(0xFFE53935)),
                                    ),
                                  ],
                                ),
                                if (c.products.isNotEmpty)
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: TextButton.icon(
                                      onPressed: () => _pickProduct(context, i),
                                      icon: const Icon(Icons.inventory_2_outlined, size: 18),
                                      label: const Text('Fill from product'),
                                    ),
                                  ),
                                const SizedBox(height: 8),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(child: _lineField(context, 'Qty', line.qtyCtrl, '1')),
                                    const SizedBox(width: 8),
                                    Expanded(child: _lineField(context, 'Unit price', line.unitCtrl, '0.00')),
                                    const SizedBox(width: 8),
                                    Expanded(child: _lineField(context, 'Discount', line.discountCtrl, '0')),
                                    const SizedBox(width: 8),
                                    Expanded(child: _lineField(context, 'GST %', line.gstCtrl, '0')),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Line total: ${line.computedTotal(taxType: tt).toStringAsFixed(2)}',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF26A69A)),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    );
                  }),
                        Center(
                          child: Material(
                            color: kSalesAccent,
                            shape: const CircleBorder(),
                            elevation: 2,
                            shadowColor: Colors.black38,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: c.addLine,
                              child: const Padding(
                                padding: EdgeInsets.all(14),
                                child: Icon(Icons.add, color: Colors.white, size: 28),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  _extraChargesCard(context),
                  const SizedBox(height: 12),

                  // ── Payment ────────────────────────────────────────
                  _paymentCard(context),
                  const SizedBox(height: 20),

                  // ── Totals card ────────────────────────────────────
                  Obx(() => salesTotalsCard(
                        context: context,
                        lines: c.lines,
                        gstType: c.gstTypeValue.value,
                        taxType: c.taxTypeValue.value,
                        discountAmountCtrl: c.discountAmountCtrl,
                        shippingAmountCtrl: c.shippingAmountCtrl,
                        roundOffCtrl: c.roundOffCtrl,
                      )),
                ],
              ),
            ),

            // ── Bottom save button ─────────────────────────────────
            SafeArea(
              top: false,
              child: Material(
                elevation: Theme.of(context).brightness == Brightness.dark ? 8 : 6,
                shadowColor: Colors.black38,
                color: Theme.of(context).colorScheme.surfaceContainer,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: c.isSaving.value ? null : c.submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: kSalesAccent,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Theme.of(context).brightness == Brightness.dark
                            ? Colors.grey.shade800
                            : Colors.grey.shade400,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: c.isSaving.value
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                            )
                          : const Text('Create order',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  Widget _lineField(BuildContext context, String label, TextEditingController ctrl, String hint) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(label, style: salesLineItemCaption(context)),
      const SizedBox(height: 4),
      TextField(
        controller: ctrl,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
        decoration: salesOutlineField(context, hintText: hint),
        onChanged: (_) => c.lines.refresh(),
      ),
    ]);
  }

  Widget _extraChargesCard(BuildContext context) {
    return SalesFormSectionCard(
      title: 'Extra charges',
      child: Column(
        children: [
          salesTwoColRow(
            context: context,
            label1: 'Discount (₹)',
            ctrl1: c.discountAmountCtrl,
            label2: 'Shipping (₹)',
            ctrl2: c.shippingAmountCtrl,
            onChanged: () => c.lines.refresh(),
          ),
          const SizedBox(height: 10),
          salesTwoColRow(
            context: context,
            label1: 'Extra Discount (₹)',
            ctrl1: c.extraDiscountCtrl,
            label2: 'Round Off (₹)',
            ctrl2: c.roundOffCtrl,
            onChanged: () => c.lines.refresh(),
          ),
        ],
      ),
    );
  }

  Widget _paymentCard(BuildContext context) {
    return SalesFormSectionCard(
      title: 'Payment',
      child: Column(
        children: [
          Obx(() => salesDropdownRow(
                context: context,
                label: 'Payment Terms',
                options: kPaymentTermsOptions,
                value: c.paymentTermsValue.value,
                onChanged: (v) => c.paymentTermsValue.value = v,
                hint: 'Select terms…',
              )),
          const SizedBox(height: 10),
          Obx(() => salesDropdownRow(
                context: context,
                label: 'Payment Method',
                options: kPaymentMethodOptions,
                value: c.paymentMethodValue.value,
                onChanged: (v) => c.paymentMethodValue.value = v,
                hint: 'Select method…',
              )),
        ],
      ),
    );
  }

  Future<void> _pickProduct(BuildContext context, int lineIndex) async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => salesProductPickerSheet(
        context: ctx,
        products: c.products.toList(),
        onPick: (p) => Navigator.pop(ctx, p),
      ),
    );
    if (picked != null) c.applyProductToLine(lineIndex, picked);
  }
}
