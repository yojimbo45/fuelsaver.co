import 'package:flutter/material.dart';
import '../../config/countries.dart';
import '../../config/theme.dart';
import '../../models/country_config.dart';
import '../../models/trip_models.dart';
import '../../utils/format.dart';
import '../brand_logo_widget.dart';

String _formatDuration(double seconds) {
  final h = seconds ~/ 3600;
  final m = ((seconds % 3600) / 60).round();
  if (h == 0) return '$m min';
  return '${h}h ${m}min';
}

class TripResultsWidget extends StatelessWidget {
  final TripCost tripCost;
  final CountryConfig? countryData;
  final String? fuelType;
  final double tankCapacity;
  final List<TripStation> recommendedStations;
  final bool stationsLoading;
  final ValueChanged<TripStation>? onStationTap;

  const TripResultsWidget({
    super.key,
    required this.tripCost,
    this.countryData,
    this.fuelType,
    required this.tankCapacity,
    required this.recommendedStations,
    required this.stationsLoading,
    this.onStationTap,
  });

  @override
  Widget build(BuildContext context) {
    final fuelLabel = countryData?.fuelTypes
            .where((f) => f.id == fuelType)
            .firstOrNull
            ?.label ??
        fuelType ??
        '';
    final currency = countryData?.currency ?? '\u20AC';
    final unit = countryData?.unit ?? 'L';
    final refills = tankCapacity > 0
        ? (tripCost.fuelNeeded / tankCapacity).ceil() - 1
        : 0;
    final rangePerTank = tankCapacity > 0 && tripCost.fuelNeeded > 0
        ? (tankCapacity / tripCost.fuelNeeded * tripCost.distance)
            .toStringAsFixed(0)
        : null;

    final top3 = recommendedStations.take(3).toList();
    final rest = recommendedStations.length > 3
        ? recommendedStations.sublist(3)
        : <TripStation>[];

    // Savings calculation
    final cheapest =
        recommendedStations.isNotEmpty ? recommendedStations.first : null;
    final avgPrice = recommendedStations.isNotEmpty
        ? recommendedStations.fold<double>(0, (s, st) => s + st.price) /
            recommendedStations.length
        : null;
    final hasSavings =
        cheapest != null && avgPrice != null && avgPrice > cheapest.price;
    final savingPerUnit = hasSavings ? avgPrice - cheapest.price : 0.0;
    final tripSaving = savingPerUnit * tripCost.fuelNeeded;
    final costAtCheapest =
        cheapest != null ? cheapest.price * tripCost.fuelNeeded : tripCost.cost;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Trip summary card
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Trip Estimate',
                  style:
                      TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              _resultRow('Distance', '${tripCost.distance.toStringAsFixed(1)} km'),
              _resultRow('Duration', _formatDuration(tripCost.duration)),
              _resultRow(
                  'Fuel needed ($fuelLabel)',
                  '${tripCost.fuelNeeded.toStringAsFixed(1)} $unit'),
              if (refills > 0)
                _resultRow(
                  'Refills needed',
                  '$refills stop${refills > 1 ? 's' : ''}${rangePerTank != null ? ' ($rangePerTank km/tank)' : ''}',
                ),
              const Divider(height: 16),
              _resultRow(
                'Estimated cost',
                formatPriceShort(
                    hasSavings ? costAtCheapest : tripCost.cost, currency),
                bold: true,
              ),
            ],
          ),
        ),

        // Savings banner
        if (hasSavings)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.greenCheap.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border:
                  Border.all(color: AppTheme.greenCheap.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.savings,
                    color: AppTheme.greenCheap, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${formatPriceShort(tripSaving, currency)} saved on this trip',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      const SizedBox(height: 2),
                      Text.rich(
                        TextSpan(children: [
                          const TextSpan(text: 'Best '),
                          TextSpan(
                            text: formatPrice(cheapest.price, currency),
                            style: const TextStyle(
                                color: AppTheme.greenCheap,
                                fontWeight: FontWeight.w600),
                          ),
                          const TextSpan(text: ' vs avg '),
                          TextSpan(
                            text: formatPrice(avgPrice, currency),
                            style: const TextStyle(
                                color: AppTheme.redExpensive,
                                fontWeight: FontWeight.w600),
                          ),
                          TextSpan(
                              text:
                                  ' \u00B7 ${recommendedStations.length} stations'),
                        ]),
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

        // Disclaimer when no savings
        if (!hasSavings)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Text(
              stationsLoading
                  ? 'Searching stations along route...'
                  : recommendedStations.isNotEmpty
                      ? 'Based on ${recommendedStations.length} stations along route'
                      : 'Based on estimated national average',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
          ),

        // Top 3 cheapest stations
        if (top3.isNotEmpty || stationsLoading) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                const Text('Cheapest Stations Along Route',
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                if (stationsLoading) ...[
                  const SizedBox(width: 8),
                  const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2)),
                ],
              ],
            ),
          ),
          if (!stationsLoading && top3.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('No stations found along this route',
                  style: TextStyle(
                      fontSize: 13, color: Colors.grey.shade500)),
            ),
          ...top3.map((station) => _StationCard(
                station: station,
                isBest: station == top3.first,
                currency: currency,
                onTap: () => onStationTap?.call(station),
              )),
        ],

        // All stations
        if (rest.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
                'All Stations (${recommendedStations.length})',
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold)),
          ),
          ...rest.map((station) => _StationCard(
                station: station,
                isBest: false,
                currency: currency,
                onTap: () => onStationTap?.call(station),
              )),
        ],
      ],
    );
  }

  Widget _resultRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                fontSize: 13,
                color: bold ? Colors.black : Colors.grey.shade600,
                fontWeight: bold ? FontWeight.w600 : FontWeight.normal,
              )),
          Text(value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              )),
        ],
      ),
    );
  }
}

class _StationCard extends StatelessWidget {
  final TripStation station;
  final bool isBest;
  final String currency;
  final VoidCallback? onTap;

  const _StationCard({
    required this.station,
    required this.isBest,
    required this.currency,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final stationCountry = countries[station.countryCode];
    final stationCurrency = stationCountry?.currency ?? currency;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isBest
                ? AppTheme.greenCheap.withValues(alpha: 0.4)
                : Colors.grey.shade200,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isBest)
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.greenCheap,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('Best price',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600)),
              ),
            Row(
              children: [
                BrandLogoWidget(brand: station.brand, size: 32),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(station.brand,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 13)),
                      Text(
                        '${station.address}${station.city.isNotEmpty ? ', ${station.city}' : ''}',
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade500),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  formatPrice(station.price, stationCurrency),
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  station.routeDistance < 1
                      ? 'On route'
                      : '${station.routeDistance.toStringAsFixed(1)} km off route',
                  style:
                      TextStyle(fontSize: 11, color: Colors.grey.shade500),
                ),
                if (stationCountry != null) ...[
                  const Spacer(),
                  Text(
                    '${stationCountry.flag} ${stationCountry.name}',
                    style: TextStyle(
                        fontSize: 11, color: Colors.grey.shade500),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
