import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/station.dart';
import '../models/country_config.dart';
import '../providers/sort_provider.dart';
import 'station_card_widget.dart';

class StationListWidget extends ConsumerWidget {
  final List<Station> stations;
  final String fuelType;
  final String currency;
  final CountryConfig countryConfig;
  final void Function(Station station) onStationTap;

  const StationListWidget({
    super.key,
    required this.stations,
    required this.fuelType,
    required this.currency,
    required this.countryConfig,
    required this.onStationTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sortMode = ref.watch(sortModeProvider);
    final sorted = List<Station>.from(stations);

    if (sortMode == SortMode.price) {
      sorted.sort((a, b) {
        final pa = a.prices[fuelType];
        final pb = b.prices[fuelType];
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa.compareTo(pb);
      });
    } else {
      sorted.sort((a, b) =>
          (a.distance ?? double.infinity)
              .compareTo(b.distance ?? double.infinity));
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final station = sorted[index];
          return StationCardWidget(
            station: station,
            fuelType: fuelType,
            currency: currency,
            rank: index + 1,
            onTap: () => onStationTap(station),
          );
        },
        childCount: sorted.length,
      ),
    );
  }
}
