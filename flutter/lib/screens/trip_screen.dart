import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';
import '../models/trip_models.dart';
import '../providers/trip_provider.dart';
import '../widgets/trip/trip_map_widget.dart';
import '../widgets/trip/trip_place_input.dart';
import '../widgets/trip/trip_results_widget.dart';
import '../widgets/trip/vehicle_selector_widget.dart';

const _darkBg = Color(0xFF1D212C);

class TripScreen extends ConsumerStatefulWidget {
  const TripScreen({super.key});

  @override
  ConsumerState<TripScreen> createState() => _TripScreenState();
}

class _TripScreenState extends ConsumerState<TripScreen> {
  final _sheetController = DraggableScrollableController();
  bool _showVehiclePanel = false;
  String? _vehicleName;

  void _handleVehicleSelect(Vehicle vehicle) {
    final notifier = ref.read(tripProvider.notifier);
    if (vehicle.consumption > 0) notifier.setConsumption(vehicle.consumption);
    if (vehicle.tank > 0) notifier.setTankCapacity(vehicle.tank);
    setState(() {
      _vehicleName = '${vehicle.make} ${vehicle.model}';
      _showVehiclePanel = false;
    });
  }

  void _clearVehicle() {
    setState(() => _vehicleName = null);
  }

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tripState = ref.watch(tripProvider);
    final notifier = ref.read(tripProvider.notifier);

    return Scaffold(
      body: Stack(
        children: [
          // Map
          TripMapWidget(
            route: tripState.route,
            stations: tripState.recommendedStations,
            origin: tripState.origin,
            destination: tripState.destination,
            fuelType: tripState.effectiveFuelType ?? '',
          ),

          // Back button
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 12,
            child: Material(
              elevation: 2,
              borderRadius: BorderRadius.circular(20),
              color: Colors.white,
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => Navigator.of(context).pop(),
                child: const SizedBox(
                  width: 40,
                  height: 40,
                  child: Icon(Icons.arrow_back, size: 20),
                ),
              ),
            ),
          ),

          // Loading indicator
          if (tripState.loading)
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

          // Bottom sheet
          DraggableScrollableSheet(
            controller: _sheetController,
            initialChildSize: 0.45,
            minChildSize: 0.12,
            maxChildSize: 0.92,
            snap: true,
            snapSizes: const [0.12, 0.45, 0.70, 0.92],
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
                child: _showVehiclePanel
                    ? _buildVehiclePanel(scrollController)
                    : _buildMainPanel(
                        scrollController, tripState, notifier),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildVehiclePanel(ScrollController scrollController) {
    return CustomScrollView(
      controller: scrollController,
      slivers: [
        SliverToBoxAdapter(child: _buildHandle()),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, size: 20),
                  onPressed: () =>
                      setState(() => _showVehiclePanel = false),
                ),
                const Text('Find your car',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                VehicleSelectorWidget(onSelect: _handleVehicleSelect),
          ),
        ),
      ],
    );
  }

  Widget _buildMainPanel(ScrollController scrollController,
      TripState tripState, TripNotifier notifier) {
    final fuelTypes = tripState.countryData?.fuelTypes ?? [];

    return CustomScrollView(
      controller: scrollController,
      slivers: [
        // Handle + Title
        SliverToBoxAdapter(
          child: Column(
            children: [
              _buildHandle(),
              Container(
                color: _darkBg,
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: const Text(
                  'Trip Cost Calculator',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Form
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Origin
                TripPlaceInput(
                  value: tripState.origin,
                  placeholder: 'From: city or address...',
                  dotColor: Colors.blue,
                  onSelect: notifier.setOrigin,
                  onClear: () => notifier.setOrigin(null),
                ),
                // Connector line
                _connector(),

                // Waypoints
                ...List.generate(tripState.waypoints.length, (i) {
                  return Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TripPlaceInput(
                              value: tripState.waypoints[i],
                              placeholder: 'Stop ${i + 1}...',
                              dotColor: AppTheme.primaryOrange,
                              onSelect: (p) => notifier.updateWaypoint(i, p),
                              onClear: () =>
                                  notifier.updateWaypoint(i, null),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => notifier.removeWaypoint(i),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 32, minHeight: 32),
                          ),
                        ],
                      ),
                      _connector(),
                    ],
                  );
                }),

                // Destination
                TripPlaceInput(
                  value: tripState.destination,
                  placeholder: 'To: city or address...',
                  dotColor: Colors.red,
                  onSelect: notifier.setDestination,
                  onClear: () => notifier.setDestination(null),
                ),

                const SizedBox(height: 12),

                // Add stop + Invert
                Row(
                  children: [
                    TextButton.icon(
                      onPressed: notifier.addWaypoint,
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Add a stop',
                          style: TextStyle(fontSize: 13)),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.primaryOrange,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: notifier.invertRoute,
                      icon: const Icon(Icons.swap_vert, size: 16),
                      label: const Text('Invert',
                          style: TextStyle(fontSize: 13)),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.grey.shade600,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Consumption + Fuel type
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Consumption',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade600,
                                  fontWeight: FontWeight.w500)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              _stepButton(Icons.remove, () {
                                if (_vehicleName == null) {
                                  notifier.setConsumption(
                                      tripState.consumption - 0.5);
                                }
                              }),
                              const SizedBox(width: 6),
                              Text(
                                '${tripState.consumption.toStringAsFixed(1)} L/100km',
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                              const SizedBox(width: 6),
                              _stepButton(Icons.add, () {
                                if (_vehicleName == null) {
                                  notifier.setConsumption(
                                      tripState.consumption + 0.5);
                                }
                              }),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (fuelTypes.isNotEmpty) ...[
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Fuel type',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                    fontWeight: FontWeight.w500)),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10),
                              decoration: BoxDecoration(
                                border: Border.all(
                                    color: Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: tripState.effectiveFuelType,
                                  isExpanded: true,
                                  isDense: true,
                                  style: const TextStyle(
                                      fontSize: 13,
                                      color: Colors.black87),
                                  items: fuelTypes
                                      .map((ft) => DropdownMenuItem(
                                            value: ft.id,
                                            child: Text(ft.label),
                                          ))
                                      .toList(),
                                  onChanged: _vehicleName != null
                                      ? null
                                      : (val) => notifier.setFuelType(val),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 12),

                // Vehicle selector
                if (_vehicleName != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.directions_car,
                            size: 16, color: Colors.grey),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_vehicleName!,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500)),
                        ),
                        GestureDetector(
                          onTap: _clearVehicle,
                          child: const Icon(Icons.close, size: 16),
                        ),
                      ],
                    ),
                  )
                else
                  OutlinedButton.icon(
                    onPressed: () =>
                        setState(() => _showVehiclePanel = true),
                    icon: const Icon(Icons.directions_car, size: 16),
                    label: const Text('Find your car'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.grey.shade700,
                      side: BorderSide(color: Colors.grey.shade300),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                    ),
                  ),

                const SizedBox(height: 16),

                // Calculate button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: tripState.origin != null &&
                            tripState.destination != null &&
                            !tripState.loading
                        ? () => notifier.calculate()
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryOrange,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey.shade300,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: Text(
                      tripState.loading
                          ? 'Calculating...'
                          : 'Search for itinerary',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),

                // Error
                if (tripState.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      tripState.error!,
                      style: const TextStyle(
                          color: Colors.red, fontSize: 13),
                    ),
                  ),
              ],
            ),
          ),
        ),

        // Results
        if (tripState.tripCost != null)
          SliverToBoxAdapter(
            child: TripResultsWidget(
              tripCost: tripState.tripCost!,
              countryData: tripState.countryData,
              fuelType: tripState.effectiveFuelType,
              tankCapacity: tripState.tankCapacity,
              recommendedStations: tripState.recommendedStations,
              stationsLoading: tripState.stationsLoading,
            ),
          ),

        SliverToBoxAdapter(
          child:
              SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
        ),
      ],
    );
  }

  Widget _buildHandle() {
    return Container(
      color: _darkBg,
      child: Center(
        child: Container(
          width: 36,
          height: 4,
          margin: const EdgeInsets.only(top: 8, bottom: 8),
          decoration: BoxDecoration(
            color: Colors.grey.shade500,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }

  Widget _connector() {
    return Padding(
      padding: const EdgeInsets.only(left: 5),
      child: Container(
        width: 2,
        height: 16,
        color: Colors.grey.shade300,
      ),
    );
  }

  Widget _stepButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 16, color: Colors.grey.shade600),
      ),
    );
  }
}
