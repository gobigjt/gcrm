import 'package:flutter/material.dart';

import 'showcase_colors.dart';

/// Uppercase section label (wireframe `.sec`).
class ShowcaseSectionTitle extends StatelessWidget {
  const ShowcaseSectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 6),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

/// Home top bar: title left, optional trailing (refresh, bell, avatar).
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
    final onSurface = scheme.onSurface;
    final initial = (avatarInitial != null && avatarInitial!.isNotEmpty)
        ? avatarInitial![0].toUpperCase()
        : '?';
    return Container(
      padding: const EdgeInsets.fromLTRB(11, 10, 11, 10),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (onOpenMenu != null) ...[
            IconButton(
              onPressed: onOpenMenu,
              icon: const Icon(Icons.menu_rounded, size: 24),
              color: onSurface,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              tooltip: 'Menu',
            ),
            const SizedBox(width: 4),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: onSurface,
                    height: 1.25,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 3),
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
              icon: const Icon(Icons.refresh_rounded, size: 22),
              color: onSurface,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              tooltip: '',
            ),
          if (onNotifications != null) ...[
            IconButton(
              onPressed: onNotifications,
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications_none_rounded, size: 22),
                  if (notificationBadgeCount > 0)
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                        child: Text(
                          notificationBadgeCount > 99 ? '99+' : '$notificationBadgeCount',
                          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              color: onSurface,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              tooltip: '',
            ),
          ],
          if (onLogout != null)
            IconButton(
              onPressed: onLogout,
              icon: const Icon(Icons.logout_rounded, size: 22),
              color: onSurface,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              tooltip: '',
            ),
          CircleAvatar(
            radius: 16,
            backgroundColor: ShowcaseColors.accentLight,
            child: Text(
              initial,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: ShowcaseColors.accentDark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 2×2 KPI grid — matches documents/EZcrmcrm_mobile_showcase_1.html `.krow` / `.kc` / `.kl` / `.kv` / `.kt`.
class ShowcaseKpiGrid extends StatelessWidget {
  const ShowcaseKpiGrid({
    super.key,
    required this.cells,
  });

  final List<ShowcaseKpiCell> cells;

  static const double _gap = 5;

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

  /// Showcase `--color-background-secondary` (light); dark uses theme surface.
  static const Color _cardBgLight = Color(0xFFF1EFE8);

  /// Showcase `--color-text-secondary` (light).
  static const Color _labelLight = Color(0xFF73726C);

  /// Showcase `--color-text-primary` on KPI cards (light).
  static const Color _valueLight = Color(0xFF1A1A18);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? scheme.surfaceContainer : _cardBgLight;
    final labelColor = isDark ? scheme.onSurfaceVariant : _labelLight;
    final valueColor = data.valueColor ?? (isDark ? scheme.onSurface : _valueLight);
    // HTML uses #27500A for `.kt`; on dark cards use palette green for contrast.
    final hintPositive = isDark ? ShowcaseColors.green : ShowcaseColors.greenText;

    final borderSide = BorderSide(
      color: isDark ? const Color(0x1AFFFFFF) : const Color(0x1A000000),
    );
    final radius = BorderRadius.circular(12);

    final inner = Padding(
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            data.label,
            style: TextStyle(
              fontSize: 12,
              height: 1.15,
              color: labelColor,
              fontWeight: FontWeight.w500,
              letterSpacing: -0.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            data.value,
            style: TextStyle(
              fontSize: 19,
              height: 1.15,
              fontWeight: FontWeight.w500,
              color: valueColor,
              letterSpacing: -0.2,
            ),
          ),
          if (data.hint != null && data.hint!.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              data.hint!,
              style: TextStyle(
                fontSize: 12,
                height: 1.2,
                color: data.valueColor != null ? data.valueColor! : hintPositive,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );

    if (data.onTap == null) {
      return Container(
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: radius,
          border: Border.all(color: borderSide.color),
        ),
        child: inner,
      );
    }

    return Material(
      color: cardBg,
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

/// Stage / status pill colors from wireframe.
class ShowcaseStagePill extends StatelessWidget {
  const ShowcaseStagePill(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final s = label.toLowerCase();
    Color bg;
    Color fg;
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }
}

/// List row with left dot (wireframe `.lrow`).
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
    final child = Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: dotColor ?? ShowcaseColors.accent,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
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
    if (onTap != null) {
      return InkWell(onTap: onTap, child: child);
    }
    return child;
  }
}
