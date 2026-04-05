import 'package:flutter/material.dart';
import '../models/station.dart';
import '../utils/format.dart';
import '../utils/geo.dart';
import 'brand_logo_widget.dart';

class StationCardWidget extends StatelessWidget {
  final Station station;
  final String fuelType;
  final String currency;
  final int rank;
  final VoidCallback? onTap;

  const StationCardWidget({
    super.key,
    required this.station,
    required this.fuelType,
    required this.currency,
    required this.rank,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final price = station.prices[fuelType];
    final updatedText = formatUpdated(station.updatedAt);

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Colors.grey.shade200, width: 0.5),
            right: BorderSide(color: Colors.grey.shade200, width: 0.5),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: logo + brand + price
            Row(
              children: [
                BrandLogoWidget(brand: station.brand, size: 24),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    station.brand,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  _formatPriceLarge(price, currency),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: price != null ? Colors.black87 : Colors.grey,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            // City / address
            Text(
              station.city.isNotEmpty ? station.city : station.address,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              overflow: TextOverflow.ellipsis,
            ),
            // Distance + updated
            Row(
              children: [
                if (station.distance != null)
                  Flexible(
                    child: Text(
                      formatDistance(station.distance!),
                      style:
                          TextStyle(fontSize: 11, color: Colors.grey.shade600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                const Spacer(),
                if (updatedText.isNotEmpty)
                  Flexible(
                    child: Text(
                      updatedText,
                      style: TextStyle(
                        fontSize: 10,
                        fontStyle: FontStyle.italic,
                        color: _verifiedColor(updatedText),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Format price like "1,649 €" for the large display
  String _formatPriceLarge(double? price, String currency) {
    if (price == null) return '\u2014';
    if (currency == 'p') return '${price.toStringAsFixed(1)}p';
    if (currency == 'c') return '${price.toStringAsFixed(1)}c';
    // Format with comma as decimal separator for EUR style
    if (currency == '\u20AC' || currency == 'CHF') {
      final parts = price.toStringAsFixed(3).split('.');
      return '${parts[0]},${parts[1]} $currency';
    }
    return '$currency\u00A0${price.toStringAsFixed(3)}';
  }

  Color _verifiedColor(String text) {
    if (text.contains('today') || text.contains("aujourd'hui")) {
      return const Color(0xFF00B894); // teal/green
    }
    return const Color(0xFFE74C3C); // red for older
  }
}
