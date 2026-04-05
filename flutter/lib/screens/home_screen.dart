import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../config/countries.dart';
import '../models/station.dart';
import '../providers/country_provider.dart';
import '../utils/geo.dart' show detectCountryFromCoords;
import '../providers/search_provider.dart';
import '../providers/sort_provider.dart';
import '../widgets/fuel_map_widget.dart';
import '../widgets/station_card_widget.dart';
import '../widgets/station_detail_sheet.dart';
import '../widgets/review_prompt_dialog.dart';
import '../services/review_service.dart';
import '../widgets/trip/trip_planning_sheet.dart';

const _darkBg = Color(0xFF1D212C);

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Station? _highlightedStation;
  MapTarget? _flyToTarget;
  Timer? _debounceTimer;
  final _sheetController = DraggableScrollableController();
  // Height of collapsed header: handle(26) + row(44) = ~70px
  // On a ~850pt screen that's about 0.082
  static const _collapsedFraction = 0.085;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 2), _checkReviewPrompt);
  }

  Future<void> _checkReviewPrompt() async {
    if (!mounted) return;
    if (await ReviewService.shouldShowReviewPrompt()) {
      if (mounted) showReviewPrompt(context);
    }
  }

  void _onStationTap(Station station) {
    final config = ref.read(countryConfigProvider);
    final fuelType = ref.read(fuelTypeProvider);
    showStationDetail(context, station, config, fuelType);
    setState(() => _highlightedStation = station);
  }

  void _onRegionChanged(double lat, double lng, double radiusKm) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 1200), () {
      _detectCountry(lat, lng);
      ref.read(searchProvider.notifier).search(lat, lng, radiusKm: radiusKm);
    });
  }

  void _detectCountry(double lat, double lng) {
    final detected = detectCountryFromCoords(lat, lng);
    if (detected != null && countries.containsKey(detected)) {
      if (ref.read(countryCodeProvider) != detected) {
        ref.read(countryCodeProvider.notifier).state = detected;
        ref.read(fuelTypeProvider.notifier).state = countries[detected]!.defaultFuel;
      }
    }
  }

  Future<void> _onLocateMe() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Location permission denied')));
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition();
      setState(() {
        _flyToTarget = MapTarget(pos.latitude, pos.longitude);
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not get location: $e')));
      }
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _sheetController.dispose();
    super.dispose();
  }

  void _onFuelTypeChanged(String? val) {
    if (val == null) return;
    ref.read(fuelTypeProvider.notifier).state = val;
    final sc = ref.read(searchProvider).searchCenter;
    if (sc != null) {
      ref
          .read(searchProvider.notifier)
          .search(sc.lat, sc.lng, radiusKm: sc.radiusKm);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(countryConfigProvider);
    final fuelType = ref.watch(fuelTypeProvider);
    final searchState = ref.watch(searchProvider);
    final sortMode = ref.watch(sortModeProvider);
    final sorted = ref.watch(sortedStationsProvider);

    return Scaffold(
      body: Stack(
        children: [
          // Full-screen map
          RepaintBoundary(child: FuelMapWidget(
            centerLat: config.centerLat,
            centerLng: config.centerLng,
            zoom: config.zoom,
            stations: searchState.stations,
            fuelType: fuelType,
            currency: config.currency,
            searchCenter: searchState.searchCenter,
            highlightedStation: _highlightedStation,
            flyToTarget: _flyToTarget,
            onStationTap: _onStationTap,
            onRegionChanged: _onRegionChanged,
          )),

          // Loading indicator
          if (searchState.loading)
            Positioned(
              top: MediaQuery.of(context).padding.top + 12,
              left: 0,
              right: 0,
              child: const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
              ),
            ),

          // Trip planner FAB
          Positioned(
            right: 16,
            bottom: MediaQuery.of(context).padding.bottom +
                (searchState.stations.isNotEmpty ? 330 : 140),
            child: FloatingActionButton.small(
              heroTag: 'trip',
              onPressed: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const TripPlanningSheet(),
              ),
              backgroundColor: const Color(0xFFF97316),
              foregroundColor: Colors.white,
              child: const Icon(Icons.route),
            ),
          ),

          // My location FAB
          Positioned(
            right: 16,
            bottom: MediaQuery.of(context).padding.bottom +
                (searchState.stations.isNotEmpty ? 280 : 90),
            child: FloatingActionButton.small(
              heroTag: 'locate',
              onPressed: _onLocateMe,
              backgroundColor: Colors.white,
              foregroundColor: Colors.black87,
              child: const Icon(Icons.my_location),
            ),
          ),

          // Bottom sheet
          DraggableScrollableSheet(
            controller: _sheetController,
            initialChildSize:
                searchState.stations.isNotEmpty ? 0.40 : _collapsedFraction,
            minChildSize: _collapsedFraction,
            maxChildSize: 0.9,
            snap: true,
            snapSizes: [_collapsedFraction, 0.40, 0.65, 0.9],
            builder: (context, scrollController) {
              return Container(
                clipBehavior: Clip.antiAlias,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(16)),
                  boxShadow: [
                    BoxShadow(
                      blurRadius: 10,
                      color: Colors.black26,
                      offset: Offset(0, -2),
                    ),
                  ],
                ),
                child: CustomScrollView(
                  controller: scrollController,
                  slivers: [
                    // Collapsed header: always visible
                    // Dark bar with handle + "Carburant" + fuel dropdown
                    SliverToBoxAdapter(
                      child: Container(
                        color: _darkBg,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Handle
                            Center(
                              child: Container(
                                width: 36,
                                height: 4,
                                margin:
                                    const EdgeInsets.only(top: 8, bottom: 8),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade500,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ),
                            // Row: Fuel column (centered) + Sort column (centered)
                            Padding(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 0, 16, 12),
                              child: Row(
                                children: [
                                  // Fuel column
                                  Expanded(
                                    child: Column(
                                      children: [
                                        const Text(
                                          'Carburant',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                            color: Colors.white,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF97316),
                                            borderRadius:
                                                BorderRadius.circular(18),
                                          ),
                                          child: DropdownButtonHideUnderline(
                                            child: DropdownButton<String>(
                                              value: fuelType,
                                              isDense: true,
                                              dropdownColor:
                                                  const Color(0xFF2A2F3C),
                                              icon: const Icon(
                                                  Icons.arrow_drop_down,
                                                  color: Colors.white,
                                                  size: 18),
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.white,
                                              ),
                                              items: config.fuelTypes
                                                  .map((ft) => DropdownMenuItem(
                                                        value: ft.id,
                                                        child: Text(
                                                          '${ft.id}  ${ft.label}',
                                                          style: const TextStyle(
                                                              color:
                                                                  Colors.white),
                                                        ),
                                                      ))
                                                  .toList(),
                                              onChanged: _onFuelTypeChanged,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  // Sort column
                                  Expanded(
                                    child: Column(
                                      children: [
                                        const Text(
                                          'Sort stations',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                            color: Colors.white,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Container(
                                            decoration: BoxDecoration(
                                              color: Colors.white
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                _sortButton(
                                                  'La moins ch\u00E8re',
                                                  sortMode == SortMode.price,
                                                  () => ref
                                                      .read(sortModeProvider
                                                          .notifier)
                                                      .state = SortMode.price,
                                                ),
                                                _sortButton(
                                                  'La plus proche',
                                                  sortMode == SortMode.distance,
                                                  () => ref
                                                      .read(sortModeProvider
                                                          .notifier)
                                                      .state = SortMode.distance,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Station list
                    if (sorted.isEmpty && !searchState.loading)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 32),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.search,
                                  size: 48,
                                  color: Colors.grey.shade400,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No station found',
                                  style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Expand the search area',
                                  style: TextStyle(
                                    color: Colors.orange,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final station = sorted[index];
                          return StationCardWidget(
                            station: station,
                            fuelType: fuelType,
                            currency: config.currency,
                            rank: index + 1,
                            onTap: () => _onStationTap(station),
                          );
                        },
                        childCount: sorted.length,
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: SizedBox(
                          height:
                              MediaQuery.of(context).padding.bottom + 16),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _sortButton(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: selected ? _darkBg : Colors.white70,
          ),
        ),
      ),
    );
  }
}
