import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

abstract class AppTheme {
  /// Stronger body / title contrast (WCAG-friendly on surfaces).
  static TextTheme _textThemeFor(ColorScheme scheme, ThemeData base) {
    return base.textTheme.apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );
  }

  static ThemeData get lightTheme {
    final seeded = ColorScheme.fromSeed(
      seedColor: const Color(0xFF185FA5),
      brightness: Brightness.light,
    );
    final scheme = seeded.copyWith(
      onSurface: const Color(0xFF070B12),
      onSurfaceVariant: const Color(0xFF2E3D4F),
      outline: const Color(0xFF6B7C90),
      outlineVariant: const Color(0xFFC8D2DF),
    );
    final base = ThemeData(colorScheme: scheme, useMaterial3: true);
    final textTheme = _textThemeFor(scheme, base);

    return base.copyWith(
      textTheme: textTheme,
      primaryTextTheme: _textThemeFor(scheme, base),
      hintColor: scheme.onSurfaceVariant,
      scaffoldBackgroundColor: const Color(0xFFF4F7FB),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        color: Colors.white,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.blueGrey.shade100),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.blueGrey.shade100),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              const BorderSide(color: Color(0xFF2563EB), width: 1.5),
        ),
        isDense: true,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        textColor: scheme.onSurface,
      ),
    );
  }

  static ThemeData get darkTheme {
    final seeded = ColorScheme.fromSeed(
      seedColor: const Color(0xFF2563EB),
      brightness: Brightness.dark,
    );
    final scheme = seeded.copyWith(
      primary: const Color(0xFF7AB8FF),
      onPrimary: const Color(0xFF00152E),
      primaryContainer: const Color(0xFF003370),
      onPrimaryContainer: const Color(0xFFE3EEFF),
      surface: const Color(0xFF060A12),
      surfaceContainerLowest: const Color(0xFF060A12),
      surfaceContainerLow: const Color(0xFF0A1422),
      surfaceContainer: const Color(0xFF0E1A2E),
      surfaceContainerHigh: const Color(0xFF13203A),
      surfaceContainerHighest: const Color(0xFF1A2B48),
      outline: const Color(0xFF5A7399),
      outlineVariant: const Color(0xFF354B6E),
      onSurface: const Color(0xFFF8FAFC),
      onSurfaceVariant: const Color(0xFFC8D7EA),
      secondary: const Color(0xFF9ECAFF),
      onSecondary: const Color(0xFF001225),
    );
    final base = ThemeData(colorScheme: scheme, useMaterial3: true);
    final textTheme = _textThemeFor(scheme, base);

    return base.copyWith(
      textTheme: textTheme,
      primaryTextTheme: _textThemeFor(scheme, base),
      hintColor: scheme.onSurfaceVariant,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: scheme.surfaceContainer,
        surfaceTintColor: Colors.transparent,
      ),
      dividerColor: scheme.outlineVariant.withValues(alpha: 0.5),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: scheme.surfaceContainerHigh,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHigh,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
              color: scheme.primary.withValues(alpha: 0.9), width: 1.5),
        ),
        hintStyle: TextStyle(
            color: scheme.onSurfaceVariant.withValues(alpha: 0.88)),
        labelStyle: TextStyle(
            color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600),
        isDense: true,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        selectedColor: scheme.primaryContainer,
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        textColor: scheme.onSurface,
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: scheme.primaryContainer,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
            size: 24,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
          );
        }),
      ),
    );
  }
}
