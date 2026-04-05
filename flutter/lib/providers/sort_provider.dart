import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/station.dart';
import 'country_provider.dart';
import 'search_provider.dart';

enum SortMode { price, distance }

final sortModeProvider = StateProvider<SortMode>((ref) => SortMode.price);

final sortedStationsProvider = Provider<List<Station>>((ref) {
  final stations = ref.watch(searchProvider).stations;
  final sortMode = ref.watch(sortModeProvider);
  final fuelType = ref.watch(fuelTypeProvider);

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
    sorted.sort((a, b) => (a.distance ?? double.infinity)
        .compareTo(b.distance ?? double.infinity));
  }
  return sorted;
});
