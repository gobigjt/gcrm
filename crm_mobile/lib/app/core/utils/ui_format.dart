import 'package:flutter/material.dart';

String formatCurrencyInr(dynamic value, {int decimals = 0}) {
  final num n = (value as num?) ?? num.tryParse(value?.toString() ?? '') ?? 0;
  return 'Rs ${n.toStringAsFixed(decimals)}';
}

String toYmd(DateTime d) {
  final mm = d.month.toString().padLeft(2, '0');
  final dd = d.day.toString().padLeft(2, '0');
  return '${d.year}-$mm-$dd';
}

String formatIsoDate(dynamic value) {
  if (value == null) return '—';
  final s = value.toString();
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

Future<void> pickDateIntoController({
  required BuildContext context,
  required TextEditingController controller,
  DateTime? firstDate,
  DateTime? lastDate,
}) async {
  final now = DateTime.now();
  final parsed = DateTime.tryParse(controller.text.trim());
  final picked = await showDatePicker(
    context: context,
    initialDate: parsed ?? now,
    firstDate: firstDate ?? DateTime(2000, 1, 1),
    lastDate: lastDate ?? DateTime(2100, 12, 31),
  );
  if (picked != null) controller.text = toYmd(picked);
}
