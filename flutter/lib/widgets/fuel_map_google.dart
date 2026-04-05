import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../models/station.dart';
import '../models/search_params.dart';
import 'fuel_map_widget.dart' as shared;

class GoogleFuelMap extends StatefulWidget {
  final double centerLat;
  final double centerLng;
  final double zoom;
  final List<Station> stations;
  final String fuelType;
  final String currency;
  final SearchParams? searchCenter;
  final Station? highlightedStation;
  final shared.MapTarget? flyToTarget;
  final void Function(Station station)? onStationTap;
  final void Function(double lat, double lng, double radiusKm)? onRegionChanged;

  const GoogleFuelMap({
    super.key,
    required this.centerLat,
    required this.centerLng,
    required this.zoom,
    required this.stations,
    required this.fuelType,
    required this.currency,
    this.searchCenter,
    this.highlightedStation,
    this.flyToTarget,
    this.onStationTap,
    this.onRegionChanged,
  });

  @override
  State<GoogleFuelMap> createState() => _GoogleFuelMapState();
}

class _GoogleFuelMapState extends State<GoogleFuelMap> {
  GoogleMapController? _controller;
  final Map<String, BitmapDescriptor> _markerIcons = {};
  bool _initialLoadDone = false;

  @override
  void didUpdateWidget(GoogleFuelMap old) {
    super.didUpdateWidget(old);
    if (widget.highlightedStation != null &&
        widget.highlightedStation != old.highlightedStation) {
      _controller?.animateCamera(CameraUpdate.newLatLngZoom(
        LatLng(widget.highlightedStation!.lat, widget.highlightedStation!.lng),
        14,
      ));
    }
    if (widget.flyToTarget != null &&
        widget.flyToTarget != old.flyToTarget) {
      _controller?.animateCamera(CameraUpdate.newLatLngZoom(
        LatLng(widget.flyToTarget!.lat, widget.flyToTarget!.lng),
        14,
      ));
    }
  }

  void _onCameraIdle() async {
    if (_controller == null) return;
    final bounds = await _controller!.getVisibleRegion();
    final centerLat =
        (bounds.northeast.latitude + bounds.southwest.latitude) / 2;
    final centerLng =
        (bounds.northeast.longitude + bounds.southwest.longitude) / 2;
    final radiusKm = shared.haversineFromBounds(
      bounds.southwest.latitude,
      bounds.southwest.longitude,
      bounds.northeast.latitude,
      bounds.northeast.longitude,
    );
    widget.onRegionChanged?.call(centerLat, centerLng, radiusKm);
  }

  Future<BitmapDescriptor> _getMarkerIcon(Color color) async {
    final key = color.toString();
    if (_markerIcons.containsKey(key)) return _markerIcons[key]!;

    final img = await shared.renderMarkerIcon(color);
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
    final descriptor = BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
    _markerIcons[key] = descriptor;
    return descriptor;
  }

  @override
  Widget build(BuildContext context) {
    final withPrice = shared.sortedByPrice(widget.stations, widget.fuelType);

    return FutureBuilder<Set<Marker>>(
      future: _buildMarkers(withPrice),
      builder: (context, snapshot) {
        return GoogleMap(
          initialCameraPosition: CameraPosition(
            target: LatLng(widget.centerLat, widget.centerLng),
            zoom: widget.zoom,
          ),
          markers: snapshot.data ?? {},
          myLocationEnabled: true,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          onCameraIdle: () {
            if (!_initialLoadDone) {
              _initialLoadDone = true;
              Future.delayed(
                  const Duration(milliseconds: 800), _onCameraIdle);
            } else {
              _onCameraIdle();
            }
          },
          onMapCreated: (controller) {
            _controller = controller;
          },
        );
      },
    );
  }

  Future<Set<Marker>> _buildMarkers(List<Station> withPrice) async {
    final markers = <Marker>{};
    for (final station in widget.stations) {
      if (station.prices[widget.fuelType] == null) continue;

      final color =
          shared.getStationColor(station, widget.fuelType, withPrice);
      final icon = await _getMarkerIcon(color);

      markers.add(Marker(
        markerId: MarkerId(station.id),
        position: LatLng(station.lat, station.lng),
        icon: icon,
        onTap: () => widget.onStationTap?.call(station),
      ));
    }
    return markers;
  }
}
