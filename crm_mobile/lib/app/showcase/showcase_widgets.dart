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
    this.onNotifications,
    this.notificationBadgeCount = 0,
    this.onRefresh,
    this.onLogout,
    this.avatarInitial,
  });

  final String title;
  final String? subtitle;
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

/// 2×2 KPI grid (wireframe `.krow` / `.kcell`).
class ShowcaseKpiGrid extends StatelessWidget {
  const ShowcaseKpiGrid({
    super.key,
    required this.cells,
  });

  final List<ShowcaseKpiCell> cells;

  @override
  Widget build(BuildContext context) {
    assert(cells.length == 4, 'ShowcaseKpiGrid expects 4 cells');
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 6,
      crossAxisSpacing: 6,
      childAspectRatio: 1.35,
      children: cells.map((c) => _KpiCell(data: c)).toList(),
    );
  }
}

class ShowcaseKpiCell {
  const ShowcaseKpiCell({
    required this.label,
    required this.value,
    this.hint,
    this.valueColor,
  });

  final String label;
  final String value;
  final String? hint;
  final Color? valueColor;
}

class _KpiCell extends StatelessWidget {
  const _KpiCell({required this.data});

  final ShowcaseKpiCell data;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = scheme.surfaceContainerHighest;
    final border = Theme.of(context).dividerColor;
    final hintGreen = isDark ? const Color(0xFF86EFAC) : ShowcaseColors.greenText;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            data.label,
            style: TextStyle(
              fontSize: 11,
              color: scheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            data.value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: data.valueColor ?? scheme.onSurface,
            ),
          ),
          if (data.hint != null && data.hint!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              data.hint!,
              style: TextStyle(
                fontSize: 11,
                color: data.valueColor != null ? data.valueColor! : hintGreen,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
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
