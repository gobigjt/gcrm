import 'package:flutter/material.dart';

import 'showcase_colors.dart';

/// Uppercase section label with left accent bar.
class ShowcaseSectionTitle extends StatelessWidget {
  const ShowcaseSectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              color: scheme.primary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            text.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.9,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Home top bar: greeting left, actions right — with gradient glass in dark mode.
class ShowcaseHomeTopBar extends StatelessWidget {
  const ShowcaseHomeTopBar({
    super.key,
    required this.title,
    this.subtitle,
    this.onOpenMenu,
    this.onNotifications,
    this.notificationBadgeCount = 0,
    this.onRefresh,
    this.onLogout,
    this.avatarInitial,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onOpenMenu;
  final VoidCallback? onNotifications;
  final int notificationBadgeCount;
  final VoidCallback? onRefresh;
  final VoidCallback? onLogout;
  final String? avatarInitial;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final initial = (avatarInitial != null && avatarInitial!.isNotEmpty)
        ? avatarInitial![0].toUpperCase()
        : '?';

    return Container(
      padding: const EdgeInsets.fromLTRB(6, 8, 12, 8),
      decoration: BoxDecoration(
        gradient: isDark
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  ShowcaseColors.gradientTopStart,
                  ShowcaseColors.gradientTopEnd,
                ],
              )
            : null,
        color: isDark ? null : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark
                ? scheme.outlineVariant.withValues(alpha: 0.35)
                : scheme.outlineVariant.withValues(alpha: 0.6),
            width: 0.8,
          ),
        ),
        boxShadow: isDark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 3),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (onOpenMenu != null) ...[
            IconButton(
              onPressed: onOpenMenu,
              icon: const Icon(Icons.menu_rounded, size: 24),
              color: scheme.onSurface,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              tooltip: 'Menu',
            ),
            const SizedBox(width: 2),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                    height: 1.25,
                    letterSpacing: -0.2,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 12,
                      color: scheme.onSurfaceVariant,
                      height: 1.2,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (onRefresh != null)
            IconButton(
              onPressed: onRefresh,
              icon: Icon(Icons.refresh_rounded,
                  size: 20, color: scheme.onSurfaceVariant),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              tooltip: 'Refresh',
            ),
          if (onNotifications != null) ...[
            IconButton(
              onPressed: onNotifications,
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(Icons.notifications_none_rounded,
                      size: 22, color: scheme.onSurface),
                  if (notificationBadgeCount > 0)
                    Positioned(
                      right: -3,
                      top: -3,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFEF4444).withValues(alpha: 0.5),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        constraints:
                            const BoxConstraints(minWidth: 14, minHeight: 14),
                        child: Text(
                          notificationBadgeCount > 99
                              ? '99+'
                              : '$notificationBadgeCount',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ],
          if (onLogout != null)
            IconButton(
              onPressed: onLogout,
              icon: Icon(Icons.logout_rounded,
                  size: 20, color: scheme.onSurfaceVariant),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            ),
          const SizedBox(width: 4),
          // Avatar
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
              ),
              borderRadius: BorderRadius.circular(11),
              boxShadow: isDark
                  ? [
                      BoxShadow(
                        color: const Color(0xFF2563EB).withValues(alpha: 0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: Text(
                initial,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 2×2 KPI grid.
class ShowcaseKpiGrid extends StatelessWidget {
  const ShowcaseKpiGrid({
    super.key,
    required this.cells,
  });

  final List<ShowcaseKpiCell> cells;

  static const double _gap = 8;

  @override
  Widget build(BuildContext context) {
    assert(cells.length == 4, 'ShowcaseKpiGrid expects 4 cells');
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _KpiCell(data: cells[0])),
            const SizedBox(width: _gap),
            Expanded(child: _KpiCell(data: cells[1])),
          ],
        ),
        const SizedBox(height: _gap),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _KpiCell(data: cells[2])),
            const SizedBox(width: _gap),
            Expanded(child: _KpiCell(data: cells[3])),
          ],
        ),
      ],
    );
  }
}

class ShowcaseKpiCell {
  const ShowcaseKpiCell({
    required this.label,
    required this.value,
    this.hint,
    this.valueColor,
    this.onTap,
  });

  final String label;
  final String value;
  final String? hint;
  final Color? valueColor;

  /// When set, the cell is tappable (e.g. deep-link to CRM / Sales).
  final VoidCallback? onTap;
}

class _KpiCell extends StatelessWidget {
  const _KpiCell({required this.data});

  final ShowcaseKpiCell data;

  static const Color _cardBgLight = Color(0xFFF1EFE8);
  static const Color _labelLight = Color(0xFF73726C);
  static const Color _valueLight = Color(0xFF1A1A18);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final labelColor = isDark ? scheme.onSurfaceVariant : _labelLight;
    final valueColor =
        data.valueColor ?? (isDark ? scheme.onSurface : _valueLight);
    final hintPositive =
        isDark ? ShowcaseColors.green : ShowcaseColors.greenText;

    final radius = BorderRadius.circular(14);

    final inner = Padding(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            data.label,
            style: TextStyle(
              fontSize: 11,
              height: 1.2,
              color: labelColor,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            data.value,
            style: TextStyle(
              fontSize: 22,
              height: 1.1,
              fontWeight: FontWeight.w700,
              color: valueColor,
              letterSpacing: -0.5,
            ),
          ),
          if (data.hint != null && data.hint!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              data.hint!,
              style: TextStyle(
                fontSize: 11,
                height: 1.2,
                color: data.valueColor != null
                    ? data.valueColor!
                    : hintPositive,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );

    if (isDark) {
      final decoration = BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.surfaceContainerHigh,
            scheme.surfaceContainer,
          ],
        ),
        borderRadius: radius,
        border: Border.all(
          color: scheme.primary.withValues(alpha: 0.18),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      );

      if (data.onTap == null) {
        return Container(decoration: decoration, child: inner);
      }

      return Material(
        color: Colors.transparent,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: decoration,
          child: InkWell(onTap: data.onTap, child: inner),
        ),
      );
    }

    // Light mode
    final borderSide = BorderSide(color: const Color(0x1A000000));

    if (data.onTap == null) {
      return Container(
        decoration: BoxDecoration(
          color: _cardBgLight,
          borderRadius: radius,
          border: Border.all(color: borderSide.color),
        ),
        child: inner,
      );
    }

    return Material(
      color: _cardBgLight,
      shape: RoundedRectangleBorder(
        borderRadius: radius,
        side: borderSide,
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: data.onTap,
        borderRadius: radius,
        child: inner,
      ),
    );
  }
}

/// Stage / status pill — dark-mode optimized with vibrant colors.
class ShowcaseStagePill extends StatelessWidget {
  const ShowcaseStagePill(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final s = label.toLowerCase();

    Color bg;
    Color fg;

    if (isDark) {
      if (s.contains('won')) {
        bg = ShowcaseColors.darkWonBg;
        fg = ShowcaseColors.darkWonFg;
      } else if (s.contains('qualified')) {
        bg = ShowcaseColors.darkQualifiedBg;
        fg = ShowcaseColors.darkQualifiedFg;
      } else if (s.contains('proposal')) {
        bg = ShowcaseColors.darkProposalBg;
        fg = ShowcaseColors.darkProposalFg;
      } else if (s.contains('lost')) {
        bg = ShowcaseColors.darkLostBg;
        fg = ShowcaseColors.darkLostFg;
      } else if (s.contains('new')) {
        bg = ShowcaseColors.darkNewBg;
        fg = ShowcaseColors.darkNewFg;
      } else {
        bg = ShowcaseColors.darkDefaultBg;
        fg = ShowcaseColors.darkDefaultFg;
      }
    } else {
      if (s.contains('won')) {
        bg = ShowcaseColors.greenSoft;
        fg = ShowcaseColors.greenText;
      } else if (s.contains('qualified')) {
        bg = ShowcaseColors.amberLight;
        fg = ShowcaseColors.amberDark;
      } else if (s.contains('proposal')) {
        bg = ShowcaseColors.purpleLight;
        fg = ShowcaseColors.purpleMid;
      } else if (s.contains('lost')) {
        bg = ShowcaseColors.redLight;
        fg = ShowcaseColors.redDark;
      } else if (s.contains('new')) {
        bg = ShowcaseColors.accentLight;
        fg = ShowcaseColors.accentDark;
      } else {
        bg = ShowcaseColors.purpleLight;
        fg = ShowcaseColors.purpleMid;
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: isDark
            ? Border.all(color: fg.withValues(alpha: 0.25), width: 0.8)
            : null,
      ),
      child: Text(
        label,
        style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }
}

/// List row with left dot — subtle card-like container in dark mode.
class ShowcaseListRow extends StatelessWidget {
  const ShowcaseListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.dotColor,
    this.onTap,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Color? dotColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final rowContent = Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: dotColor ?? ShowcaseColors.accent,
                shape: BoxShape.circle,
                boxShadow: isDark
                    ? [
                        BoxShadow(
                          color: (dotColor ?? ShowcaseColors.accent)
                              .withValues(alpha: 0.5),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurface,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 11,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );

    final decorated = Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: isDark
          ? BoxDecoration(
              color: scheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: scheme.outlineVariant.withValues(alpha: 0.4),
                width: 0.8,
              ),
            )
          : null,
      child: rowContent,
    );

    if (onTap != null) {
      return isDark
          ? ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Material(
                color: Colors.transparent,
                child: InkWell(onTap: onTap, child: decorated),
              ),
            )
          : InkWell(onTap: onTap, child: decorated);
    }
    return decorated;
  }
}
