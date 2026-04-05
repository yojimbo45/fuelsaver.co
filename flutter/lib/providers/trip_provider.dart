import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/countries.dart';
import '../models/trip_models.dart';
import '../models/country_config.dart';
import '../services/routing_service.dart' as routing;
import '../services/fuel_api/fuel_api_service.dart' as fuel_api;
import '../utils/geo.dart';

// Average fuel prices by country + fuel type for cost estimation fallback
const _avgPrices = <String, Map<String, double>>{
  'FR': {'E10': 1.75, 'SP98': 1.85, 'Gazole': 1.65, 'SP95': 1.78, 'E85': 0.85, 'GPLc': 0.95},
  'DE': {'e5': 1.75, 'e10': 1.70, 'diesel': 1.65},
  'ES': {'G95E5': 1.55, 'G98E5': 1.70, 'GOA': 1.50, 'GLP': 0.90},
  'IT': {'benzina': 1.80, 'gasolio': 1.70, 'gpl': 0.75, 'metano': 1.50},
  'UK': {'E10': 139.9, 'E5': 144.9, 'B7': 144.9},
  'PT': {'G95': 1.70, 'G98': 1.85, 'diesel': 1.60, 'GPLc': 0.80},
  'AT': {'super': 1.55, 'diesel': 1.50},
  'BE': {'E10': 1.70, 'SP98': 1.85, 'diesel': 1.75},
  'NL': {'euro95': 2.10, 'diesel': 1.85},
  'CH': {'unleaded95': 1.80, 'unleaded98': 1.90, 'diesel': 1.85},
  'LU': {'E10': 1.50, 'SP98': 1.60, 'diesel': 1.45},
  'HR': {'eurosuper95': 1.45, 'eurosuper100': 1.55, 'eurodizel': 1.45},
  'SI': {'NMB95': 1.45, 'NMB100': 1.55, 'dizel': 1.45},
  'PL': {'Pb95': 6.50, 'Pb98': 7.20, 'ON': 6.40, 'LPG': 2.80},
  'CZ': {'natural95': 38.0, 'natural98': 42.0, 'diesel': 37.0},
  'HU': {'E95': 600, 'diesel': 610},
  'RO': {'standard': 7.0, 'premium': 7.5, 'motorina': 7.0, 'premiumDiesel': 7.3},
  'GR': {'unleaded95': 1.80, 'unleaded100': 1.95, 'diesel': 1.65},
  'DK': {'oktan95': 13.5, 'oktan95plus': 14.5, 'diesel': 12.5},
  'AU': {'U91': 1.85, 'U95': 1.95, 'U98': 2.05, 'diesel': 1.90, 'E10': 1.80, 'LPG': 1.00},
  'KR': {'gasoline': 1700, 'diesel': 1500, 'lpg': 1000},
  'BR': {'gasolina': 5.80, 'etanol': 3.80, 'diesel': 5.50},
  'AR': {'super': 800, 'premium': 900, 'diesel': 750},
  'CL': {'gasoline93': 1100, 'gasoline95': 1200, 'gasoline97': 1300, 'diesel': 1000},
  'MX': {'regular': 22.5, 'premium': 24.5, 'diesel': 23.5},
  'IN': {'petrol': 105, 'diesel': 90},
  'NZ': {'91': 2.70, '95': 2.90, '98': 3.00, 'diesel': 2.10},
  'ZA': {'unleaded93': 24.0, 'unleaded95': 24.5, 'diesel50': 22.5, 'diesel500': 22.0},
  'IE': {'E10': 1.70, 'E5': 1.75, 'B7': 1.65},
  'JP': {'regular': 175, 'premium': 186, 'diesel': 155},
  'TH': {'gasohol91': 37, 'gasohol95': 38, 'gasoholE20': 35, 'diesel': 30, 'dieselB7': 30},
  'MY': {'RON95': 2.05, 'RON97': 3.35, 'diesel': 2.15},
  'FI': {'E10': 1.80, 'E98': 1.95, 'diesel': 1.75},
  'US': {'regular': 3.50, 'midgrade': 4.00, 'premium': 4.50, 'diesel': 3.80},
  'CA': {'regular': 1.70, 'midgrade': 1.85, 'premium': 2.00, 'diesel': 1.75},
};

class TripState {
  final TripPlace? origin;
  final TripPlace? destination;
  final List<TripPlace?> waypoints;
  final double consumption;
  final double tankCapacity;
  final String? fuelType;
  final TripRoute? route;
  final TripCost? tripCost;
  final bool loading;
  final String? error;
  final List<TripStation> recommendedStations;
  final bool stationsLoading;

  const TripState({
    this.origin,
    this.destination,
    this.waypoints = const [],
    this.consumption = 7.0,
    this.tankCapacity = 50,
    this.fuelType,
    this.route,
    this.tripCost,
    this.loading = false,
    this.error,
    this.recommendedStations = const [],
    this.stationsLoading = false,
  });

  String? get country => origin?.countryCode;
  CountryConfig? get countryData =>
      country != null ? countries[country!] : null;

  String? get effectiveFuelType {
    if (fuelType != null &&
        countryData != null &&
        countryData!.fuelTypes.any((f) => f.id == fuelType)) {
      return fuelType;
    }
    return countryData?.defaultFuel;
  }

  TripState copyWith({
    TripPlace? origin,
    TripPlace? destination,
    List<TripPlace?>? waypoints,
    double? consumption,
    double? tankCapacity,
    String? fuelType,
    TripRoute? route,
    TripCost? tripCost,
    bool? loading,
    String? error,
    List<TripStation>? recommendedStations,
    bool? stationsLoading,
    bool clearRoute = false,
    bool clearTripCost = false,
    bool clearError = false,
    bool clearOrigin = false,
    bool clearDestination = false,
    bool clearFuelType = false,
  }) =>
      TripState(
        origin: clearOrigin ? null : (origin ?? this.origin),
        destination:
            clearDestination ? null : (destination ?? this.destination),
        waypoints: waypoints ?? this.waypoints,
        consumption: consumption ?? this.consumption,
        tankCapacity: tankCapacity ?? this.tankCapacity,
        fuelType: clearFuelType ? null : (fuelType ?? this.fuelType),
        route: clearRoute ? null : (route ?? this.route),
        tripCost: clearTripCost ? null : (tripCost ?? this.tripCost),
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        recommendedStations: recommendedStations ?? this.recommendedStations,
        stationsLoading: stationsLoading ?? this.stationsLoading,
      );
}

class TripNotifier extends StateNotifier<TripState> {
  TripNotifier() : super(const TripState());

  void setOrigin(TripPlace? place) {
    if (place == null) {
      state = state.copyWith(clearOrigin: true);
    } else {
      state = state.copyWith(origin: place);
      // Set default fuel type from origin country
      if (place.countryCode != null) {
        final config = countries[place.countryCode!];
        if (config != null && state.fuelType == null) {
          state = state.copyWith(fuelType: config.defaultFuel);
        }
      }
    }
  }

  void setDestination(TripPlace? place) {
    if (place == null) {
      state = state.copyWith(clearDestination: true);
    } else {
      state = state.copyWith(destination: place);
    }
  }

  void setConsumption(double value) {
    state = state.copyWith(consumption: value.clamp(1, 30));
  }

  void setTankCapacity(double value) {
    state = state.copyWith(tankCapacity: value.clamp(10, 200));
  }

  void setFuelType(String? ft) {
    if (ft == null) {
      state = state.copyWith(clearFuelType: true);
    } else {
      state = state.copyWith(fuelType: ft);
    }
  }

  void addWaypoint() {
    state = state.copyWith(waypoints: [...state.waypoints, null]);
  }

  void removeWaypoint(int index) {
    final wp = [...state.waypoints];
    wp.removeAt(index);
    state = state.copyWith(waypoints: wp);
  }

  void updateWaypoint(int index, TripPlace? place) {
    final wp = [...state.waypoints];
    wp[index] = place;
    state = state.copyWith(waypoints: wp);
  }

  void invertRoute() {
    final prevOrigin = state.origin;
    final prevDest = state.destination;
    state = state.copyWith(
      origin: prevDest,
      destination: prevOrigin,
      waypoints: state.waypoints.reversed.toList(),
    );
  }

  Future<void> calculate() async {
    final o = state.origin;
    final d = state.destination;
    if (o == null || d == null) {
      state = state.copyWith(error: 'Please select both origin and destination');
      return;
    }

    state = state.copyWith(
      loading: true,
      clearError: true,
      clearRoute: true,
      clearTripCost: true,
      recommendedStations: [],
    );

    try {
      final points = [
        o,
        ...state.waypoints.whereType<TripPlace>(),
        d,
      ];

      final result = await routing.fetchRoute(points);
      state = state.copyWith(route: result);

      final cc = o.countryCode;
      final ccData = cc != null ? countries[cc] : null;
      final fuel = state.effectiveFuelType ??
          ccData?.defaultFuel;

      if (fuel != null && state.fuelType == null) {
        state = state.copyWith(fuelType: fuel);
      }

      final fuelNeeded = (result.distance / 100) * state.consumption;
      final fallbackPrice = _avgPrices[cc]?[fuel] ?? 0;

      state = state.copyWith(
        tripCost: TripCost(
          fuelNeeded: fuelNeeded,
          cost: fuelNeeded * fallbackPrice,
          pricePerUnit: fallbackPrice,
          distance: result.distance,
          duration: result.duration,
          stationCount: 0,
        ),
        loading: false,
      );

      // Find stations along route in the background
      _findStationsAlongRoute(result, fuel ?? '', result.distance,
          result.duration, state.consumption);
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> _findStationsAlongRoute(TripRoute routeResult, String fuel,
      double distanceKm, double durationSec, double consumptionVal) async {
    state = state.copyWith(stationsLoading: true, recommendedStations: []);

    try {
      // Adaptive intervals based on trip length
      final interval =
          distanceKm > 1000 ? 150.0 : distanceKm > 500 ? 100.0 : 50.0;
      final radius =
          distanceKm > 1000 ? 10.0 : distanceKm > 500 ? 15.0 : 20.0;

      final samplePoints =
          sampleRoutePoints(routeResult.geometry, interval);

      // Group sample points by country
      final pointsByCountry = <String, List<({double lat, double lng, double distanceFromStart})>>{};
      for (final pt in samplePoints) {
        final cc = detectCountryFromCoords(pt.lat, pt.lng);
        if (cc != null && countries.containsKey(cc)) {
          pointsByCountry.putIfAbsent(cc, () => []).add(pt);
        }
      }

      final allStations = <String, _StationWithMeta>{};
      final allFetches = <_FetchTask>[];

      for (final entry in pointsByCountry.entries) {
        final cc = entry.key;
        final pts = entry.value;
        final countryConfig = countries[cc]!;
        final countryFuelTypes = countryConfig.fuelTypes.map((f) => f.id);
        final countryFuel =
            countryFuelTypes.contains(fuel) ? fuel : countryConfig.defaultFuel;

        for (final pt in pts) {
          allFetches.add(_FetchTask(cc: cc, lat: pt.lat, lng: pt.lng, fuel: countryFuel));
        }
      }

      // Batch requests: max 3 concurrent to avoid overloading
      const batchSize = 3;
      for (var i = 0; i < allFetches.length; i += batchSize) {
        final batch = allFetches.skip(i).take(batchSize);
        await Future.wait(batch.map((task) async {
          try {
            final stations =
                await fuel_api.fetchStations(task.cc, task.lat, task.lng, radius, task.fuel);
            for (final s in stations) {
              if (!allStations.containsKey(s.id)) {
                allStations[s.id] = _StationWithMeta(
                  id: s.id,
                  brand: s.brand,
                  address: s.address,
                  city: s.city,
                  lat: s.lat,
                  lng: s.lng,
                  prices: s.prices,
                  updatedAt: s.updatedAt,
                  countryCode: task.cc,
                  countryFuel: task.fuel,
                );
              }
            }
          } catch (_) {
            // Ignore individual fetch failures
          }
        }));
      }

      // Filter candidates within 5km of route, with valid price
      final candidates = <TripStation>[];
      for (final s in allStations.values) {
        final price = s.prices[s.countryFuel];
        if (price == null || price <= 0) continue;
        final routeDist =
            distanceToRoute(s.lat, s.lng, routeResult.geometry);
        if (routeDist > 5) continue;
        candidates.add(TripStation(
          id: s.id,
          brand: s.brand,
          address: s.address,
          city: s.city,
          lat: s.lat,
          lng: s.lng,
          prices: s.prices,
          updatedAt: s.updatedAt,
          price: price,
          routeDistance: routeDist,
          countryCode: s.countryCode,
        ));
      }

      candidates.sort((a, b) => a.price.compareTo(b.price));
      final limited = candidates.length > 30 ? candidates.sublist(0, 30) : candidates;
      state = state.copyWith(
        recommendedStations: limited,
        stationsLoading: false,
      );

      // Update trip cost with actual station prices
      if (candidates.isNotEmpty && state.tripCost != null) {
        final avgPrice =
            candidates.fold<double>(0, (sum, s) => sum + s.price) /
                candidates.length;
        final fuelNeeded = (distanceKm / 100) * consumptionVal;
        state = state.copyWith(
          tripCost: state.tripCost!.copyWith(
            fuelNeeded: fuelNeeded,
            cost: fuelNeeded * avgPrice,
            pricePerUnit: avgPrice,
            stationCount: candidates.length,
          ),
        );
      }
    } catch (_) {
      state = state.copyWith(stationsLoading: false);
    }
  }
}

class _FetchTask {
  final String cc;
  final double lat;
  final double lng;
  final String fuel;
  const _FetchTask({
    required this.cc,
    required this.lat,
    required this.lng,
    required this.fuel,
  });
}

class _StationWithMeta {
  final String id, brand, address, city;
  final double lat, lng;
  final Map<String, double> prices;
  final String? updatedAt;
  final String countryCode;
  final String countryFuel;

  const _StationWithMeta({
    required this.id,
    required this.brand,
    required this.address,
    required this.city,
    required this.lat,
    required this.lng,
    required this.prices,
    this.updatedAt,
    required this.countryCode,
    required this.countryFuel,
  });
}

final tripProvider =
    StateNotifierProvider<TripNotifier, TripState>((ref) => TripNotifier());
