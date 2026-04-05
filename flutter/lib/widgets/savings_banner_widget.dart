import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/station.dart';
import '../utils/format.dart';

class SavingsBannerWidget extends StatelessWidget {
  final List<Station> stations;
  final String fuelType;
  final String currency;

  const SavingsBannerWidget({
    super.key,
    required this.stations,
    required this.fuelType,
    required this.currency,
  });

  @override
  Widget build(BuildContext context) {
    final withPrice =
        stations.where((s) => s.prices[fuelType] != null).toList();
    if (withPrice.length < 2) return const SizedBox.shrink();

    withPrice.sort(
        (a, b) => a.prices[fuelType]!.compareTo(b.prices[fuelType]!));
    final cheapest = withPrice.first.prices[fuelType]!;
    final mostExpensive = withPrice.last.prices[fuelType]!;
    final savingsPerLiter = mostExpensive - cheapest;
    final savingsOn50L = savingsPerLiter * 50;

    if (savingsPerLiter <= 0) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.greenCheap.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.greenCheap.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.savings, color: AppTheme.greenCheap, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Save up to ${formatPriceShort(savingsOn50L, currency)} on a 50L tank',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14),
                ),
                Text(
                  'Cheapest: ${formatPrice(cheapest, currency)} vs ${formatPrice(mostExpensive, currency)}',
                  style:
                      TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
