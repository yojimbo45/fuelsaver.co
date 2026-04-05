import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/station.dart';
import '../models/search_params.dart';
import '../services/fuel_api/fuel_api_service.dart' as api;
import 'country_provider.dart';

class SearchState {
  final List<Station> stations;
  final bool loading;
  final String? error;
  final SearchParams? searchCenter;

  const SearchState({
    this.stations = const [],
    this.loading = false,
    this.error,
    this.searchCenter,
  });

  SearchState copyWith({
    List<Station>? stations,
    bool? loading,
    String? error,
    SearchParams? searchCenter,
  }) =>
      SearchState(
        stations: stations ?? this.stations,
        loading: loading ?? this.loading,
        error: error,
        searchCenter: searchCenter ?? this.searchCenter,
      );
}

class SearchNotifier extends StateNotifier<SearchState> {
  final Ref ref;
  SearchNotifier(this.ref) : super(const SearchState());

  String? _lastSearchKey;
  int _searchGeneration = 0;

  String _buildKey(String cc, double lat, double lng, double r, String ft) =>
      '$cc:${lat.toStringAsFixed(2)}:${lng.toStringAsFixed(2)}:${(r / 5).round() * 5}:$ft';

  Future<void> search(double lat, double lng,
      {double? radiusKm, String? displayName}) async {
    final double radius = radiusKm ?? ref.read(radiusKmProvider);
    final countryCode = ref.read(countryCodeProvider);
    final fuelType = ref.read(fuelTypeProvider);

    // Skip if identical to last successful search
    final key = _buildKey(countryCode, lat, lng, radius, fuelType);
    if (key == _lastSearchKey && !state.loading) return;

    // Generation counter to ignore stale responses
    final gen = ++_searchGeneration;

    state = state.copyWith(
      loading: true,
      error: null,
      searchCenter: SearchParams(
          lat: lat, lng: lng, radiusKm: radius, displayName: displayName),
    );

    try {
      final stations =
          await api.fetchStations(countryCode, lat, lng, radius, fuelType);
      // Ignore if a newer search was started while we were loading
      if (gen != _searchGeneration) return;
      _lastSearchKey = key;
      state = state.copyWith(stations: stations, loading: false);
    } catch (e) {
      if (gen != _searchGeneration) return;
      state = state.copyWith(
          stations: [], loading: false, error: e.toString());
    }
  }

  void clear() {
    _lastSearchKey = null;
    _searchGeneration++;
    state = const SearchState();
  }
}

final searchProvider =
    StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  return SearchNotifier(ref);
});
