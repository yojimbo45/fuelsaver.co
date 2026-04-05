import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:apple_maps_flutter/apple_maps_flutter.dart';
import '../../models/trip_models.dart';
import '../fuel_map_widget.dart' as shared;

class TripMapApple extends StatefulWidget {
  final TripRoute? route;
  final List<TripStation> stations;
  final TripPlace? origin;
  final TripPlace? destination;
  final String fuelType;
  final ValueChanged<TripStation>? onStationTap;

  const TripMapApple({
    super.key,
    this.route,
    required this.stations,
    this.origin,
    this.destination,
    required this.fuelType,
    this.onStationTap,
  });

  @override
  State<TripMapApple> createState() => _TripMapAppleState();
}

class _TripMapAppleState extends State<TripMapApple> {
  AppleMapController? _controller;
  final Map<String, BitmapDescriptor> _markerIcons = {};
  Set<Annotation> _cachedAnnotations = {};
  Set<Polyline> _cachedPolylines = {};
  bool _annotationsBuilding = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _rebuildAnnotations();
      _cachedPolylines = _buildPolylines();
    });
  }

  @override
  void didUpdateWidget(TripMapApple old) {
    super.didUpdateWidget(old);
    if (widget.route != old.route) {
      _fitRouteBounds();
      setState(() => _cachedPolylines = _buildPolylines());
    }
    if (widget.stations != old.stations) {
      _rebuildAnnotations();
    }
  }

  Future<void> _rebuildAnnotations() async {
    if (_annotationsBuilding) return;
    _annotationsBuilding = true;
    try {
      final annotations = await _buildAnnotations();
      if (mounted) setState(() => _cachedAnnotations = annotations);
    } finally {
      _annotationsBuilding = false;
    }
  }

  void _fitRouteBounds() {
    if (_controller == null || widget.route == null) return;
    final coords = widget.route!.coordinates;
    if (coords.isEmpty) return;

    var minLat = coords.first[1];
    var maxLat = coords.first[1];
    var minLng = coords.first[0];
    var maxLng = coords.first[0];
    for (final c in coords) {
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
    }

    _controller!.animateCamera(CameraUpdate.newLatLngBounds(
      LatLngBounds(
        southwest: LatLng(minLat, minLng),
        northeast: LatLng(maxLat, maxLng),
      ),
      50,
    ));
  }

  Future<BitmapDescriptor> _getMarkerIcon(Color color) async {
    final key = color.toString();
    if (_markerIcons.containsKey(key)) return _markerIcons[key]!;

    final img = await shared.renderMarkerIcon(color);
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
    final descriptor = BitmapDescriptor.fromBytes(bytes!.buffer.asUint8List());
    _markerIcons[key] = descriptor;
    return descriptor;
  }

  static Color _stationColor(double price, double minP, double range) {
    if (range <= 0) return const Color(0xFFF97316);
    final ratio = (price - minP) / range;
    if (ratio < 0.25) return const Color(0xFF22C55E);
    if (ratio > 0.75) return const Color(0xFFEF4444);
    return const Color(0xFFF97316);
  }

  Set<Polyline> _buildPolylines() {
    if (widget.route == null) return {};
    final coords = widget.route!.coordinates;
    final points =
        coords.map<LatLng>((c) => LatLng(c[1], c[0])).toList();

    return {
      Polyline(
        polylineId: PolylineId('trip-route'),
        points: points,
        color: const Color(0xFFF97316),
        width: 4,
      ),
    };
  }

  Future<Set<Annotation>> _buildAnnotations() async {
    final annotations = <Annotation>{};
    if (widget.stations.isEmpty) return annotations;

    double minP = widget.stations.first.price;
    double maxP = widget.stations.first.price;
    for (final s in widget.stations) {
      if (s.price < minP) minP = s.price;
      if (s.price > maxP) maxP = s.price;
    }
    final range = maxP - minP;

    for (final station in widget.stations) {
      final color = _stationColor(station.price, minP, range);
      final icon = await _getMarkerIcon(color);
      annotations.add(Annotation(
        annotationId: AnnotationId(station.id),
        position: LatLng(station.lat, station.lng),
        icon: icon,
        onTap: () => widget.onStationTap?.call(station),
      ));
    }
    return annotations;
  }

  LatLng get _initialCenter {
    if (widget.origin != null) {
      return LatLng(widget.origin!.lat, widget.origin!.lng);
    }
    return const LatLng(46.6, 2.35);
  }

  @override
  Widget build(BuildContext context) {
    return AppleMap(
      initialCameraPosition: CameraPosition(
        target: _initialCenter,
        zoom: 5,
      ),
      annotations: _cachedAnnotations,
      polylines: _cachedPolylines,
      myLocationEnabled: true,
      myLocationButtonEnabled: false,
      onMapCreated: (controller) {
        _controller = controller;
        Future.delayed(const Duration(milliseconds: 500), _fitRouteBounds);
      },
    );
  }
}
