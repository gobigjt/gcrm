import 'package:flutter/material.dart';

/// JSON / Postgres often sends decimals as strings (e.g. `"73160.00"`). Never `as num?`.
num parseDynamicNum(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value;
  return num.tryParse(value.toString().trim()) ?? 0;
}

int parseDynamicInt(dynamic value) => parseDynamicNum(value).toInt();

/// Nullable integers from JSON (e.g. optional foreign keys, NUMERIC columns); tolerates stringified numbers and decimals (`"7.50"` → `7`).
int? tryParseDynamicInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  final n = num.tryParse(value.toString().trim());
  return n?.toInt();
}

String formatCurrencyInr(dynamic value, {int decimals = 0}) {
  final n = parseDynamicNum(value);
  return '₹${n.toStringAsFixed(decimals)}';
}

String toYmd(DateTime d) {
  final mm = d.month.toString().padLeft(2, '0');
  final dd = d.day.toString().padLeft(2, '0');
  return '${d.year}-$mm-$dd';
}

/// Calendar date (local timezone) for bucketing overdue / today vs raw UTC `YYYY-MM-DD` substring.
DateTime? parseLocalCalendarDay(dynamic value) {
  if (value == null) return null;
  final s = value.toString().trim();
  if (s.isEmpty) return null;
  final d = DateTime.tryParse(s);
  if (d == null) {
    if (s.length >= 10) {
      final head = s.substring(0, 10);
      final ymd = DateTime.tryParse(head);
      if (ymd == null) return null;
      return DateTime(ymd.year, ymd.month, ymd.day);
    }
    return null;
  }
  final local = d.isUtc ? d.toLocal() : d;
  return DateTime(local.year, local.month, local.day);
}

/// `YYYY-MM-DD` or `datetime-local` style string → UTC ISO8601 for Postgres `TIMESTAMPTZ`.
String dueDateForTimestamptzApi(String input) {
  final t = input.trim();
  if (t.isEmpty) return t;
  final d = DateTime.tryParse(t);
  if (d == null) return t;
  final local = d.isUtc ? d.toLocal() : d;
  return local.toUtc().toIso8601String();
}

/// Show `YYYY-MM-DD` in the user’s local calendar (fixes UTC strings showing wrong day in Asia).
String formatIsoDate(dynamic value) {
  if (value == null) return '—';
  final s = value.toString().trim();
  if (s.isEmpty) return '—';
  final day = parseLocalCalendarDay(s);
  if (day != null) return toYmd(day);
  if (s.length >= 10 && RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(s)) return s.substring(0, 10);
  return s;
}

/// Indian-style grouping, e.g. 102400 → "1,02,400.00" for display strings.
String formatInrAmountDisplay(dynamic value) {
  final n = parseDynamicNum(value);
  final negative = n < 0;
  final v = negative ? -n : n;
  final fixed = v.toStringAsFixed(2);
  final parts = fixed.split('.');
  var intPart = parts[0];
  final dec = parts.length > 1 ? parts[1] : '00';
  if (intPart.length <= 3) {
    return '${negative ? '-' : ''}$intPart.$dec';
  }
  final last3 = intPart.substring(intPart.length - 3);
  var rest = intPart.substring(0, intPart.length - 3);
  final chunks = <String>[];
  while (rest.length > 2) {
    chunks.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) chunks.insert(0, rest);
  return '${negative ? '-' : ''}${chunks.join(',')},$last3.$dec';
}

/// Reference app style: `03-Apr-2026`
String formatSalesCardDate(dynamic value) {
  final ymd = formatIsoDate(value);
  if (ymd == '—' || ymd.length < 10) return '—';
  final d = DateTime.tryParse(ymd);
  if (d == null) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final dd = d.day.toString().padLeft(2, '0');
  return '$dd-${months[d.month - 1]}-${d.year}';
}

String formatInrLine(dynamic value) => '₹${formatInrAmountDisplay(value)}';

/// UI label for company currency (ISO codes other than INR shown as-is).
String displayCurrencyLabel(String currency) {
  final t = currency.trim();
  if (t.isEmpty || t.toUpperCase() == 'INR') return '₹';
  return t;
}

/// Normalizes Indian rupee display tokens to ISO `INR` for the settings API.
String normalizeCompanyCurrencyForApi(String raw) {
  final t = raw.trim();
  if (t.isEmpty || t == '₹' || t.toUpperCase() == 'INR') return 'INR';
  return t;
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
