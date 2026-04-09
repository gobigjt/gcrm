import 'package:flutter/material.dart';

class AppErrorBanner extends StatelessWidget {
  const AppErrorBanner({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (message.trim().isEmpty) return const SizedBox.shrink();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF3D1518) : const Color(0xFFFEE2E2);
    final border = isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFCA5A5);
    final iconFg = isDark ? const Color(0xFFF87171) : const Color(0xFFB91C1C);
    final textFg = isDark ? const Color(0xFFFECACA) : const Color(0xFF7F1D1D);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(Icons.error_outline_rounded, size: 18, color: iconFg),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: textFg, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(foregroundColor: isDark ? const Color(0xFFFCA5A5) : null),
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }
}
