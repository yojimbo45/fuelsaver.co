import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:apple_maps_flutter/apple_maps_flutter.dart';
import '../models/station.dart';
import '../models/search_params.dart';
import '../utils/brand_logo.dart';
import '../utils/format.dart';
import 'fuel_map_widget.dart' as shared;

class AppleFuelMap extends StatefulWidget {
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

  const AppleFuelMap({
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
  State<AppleFuelMap> createState() => _AppleFuelMapState();
}

class _AppleFuelMapState extends State<AppleFuelMap> {
  AppleMapController? _controller;
  final Map<String, BitmapDescriptor> _pinIcons = {};
  bool _initialLoadDone = false;
  Set<Annotation> _cachedAnnotations = {};
  bool _annotationsBuilding = false;

  static const _pixelRatio = 3.0;

  // Logo cache shared with MapLibre (same static cache pattern)
  static final _logoCache = <String, ui.Image?>{};
  static final _logoPending = <String, Future<ui.Image?>>{};
  static final _logoDio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
    responseType: ResponseType.bytes,
  ));

  static Future<ui.Image?> _loadLogo(String brand) async {
    if (_logoCache.containsKey(brand)) return _logoCache[brand];
    if (_logoPending.containsKey(brand)) return _logoPending[brand];

    final url = getBrandLogoUrl(brand);
    if (url == null) {
      _logoCache[brand] = null;
      return null;
    }

    final future = _fetchLogoImage(url);
    _logoPending[brand] = future;
    final img = await future;
    _logoCache[brand] = img;
    _logoPending.remove(brand);
    return img;
  }

  static Future<ui.Image?> _fetchLogoImage(String url) async {
    try {
      final resp = await _logoDio.get<List<int>>(url);
      final bytes = resp.data;
      if (bytes == null || bytes.length < 8) return null;

      // Skip SVG/XML responses that can't be decoded as raster images
      final header = bytes.take(5).toList();
      if (header[0] == 0x3C) return null; // starts with '<' (XML/SVG)

      final data = Uint8List.fromList(bytes);
      final codec = await ui.instantiateImageCodec(data);
      final frame = await codec.getNextFrame();
      return frame.image;
    } catch (_) {
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _rebuildAnnotations());
  }

  @override
  void didUpdateWidget(AppleFuelMap old) {
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
    if (widget.stations != old.stations || widget.fuelType != old.fuelType) {
      _rebuildAnnotations();
    }
  }

  Future<void> _rebuildAnnotations() async {
    if (_annotationsBuilding) return;
    _annotationsBuilding = true;
    try {
      final withPrice = shared.sortedByPrice(widget.stations, widget.fuelType);
      final annotations = await _buildAnnotations(withPrice);
      if (mounted) setState(() => _cachedAnnotations = annotations);
    } finally {
      _annotationsBuilding = false;
    }
  }

  String _pinKey(Station station, String priceText, Color color) {
    final brand = station.brand.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    return '${color.toARGB32()}-$brand-${priceText.replaceAll(RegExp(r'[^a-zA-Z0-9.]'), '_')}';
  }

  Future<BitmapDescriptor> _getPinIcon(
      Station station, String priceText, Color color) async {
    final key = _pinKey(station, priceText, color);
    if (_pinIcons.containsKey(key)) return _pinIcons[key]!;

    final letter =
        station.brand.isNotEmpty ? station.brand[0].toUpperCase() : '?';
    final logo = _logoCache[station.brand];
    final pngBytes = await shared.renderPinMarkerIcon(
      priceText: priceText,
      brandLetter: letter,
      accentColor: color,
      logoImage: logo,
      pixelRatio: _pixelRatio,
    );
    final descriptor = BitmapDescriptor.fromBytes(pngBytes);
    _pinIcons[key] = descriptor;
    return descriptor;
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

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        AppleMap(
          initialCameraPosition: CameraPosition(
            target: LatLng(widget.centerLat, widget.centerLng),
            zoom: widget.zoom,
          ),
          annotations: _cachedAnnotations,
          myLocationEnabled: true,
          myLocationButtonEnabled: false,
          onCameraIdle: () {
            if (!_initialLoadDone) {
              _initialLoadDone = true;
              Future.delayed(const Duration(milliseconds: 800), _onCameraIdle);
            } else {
              _onCameraIdle();
            }
          },
          onMapCreated: (controller) {
            _controller = controller;
          },
        ),
        Positioned(
          top: MediaQuery.of(context).padding.top + 12,
          right: 12,
          child: Column(
            children: [
              _ZoomButton(
                icon: Icons.add,
                onTap: () => _controller?.animateCamera(CameraUpdate.zoomIn()),
              ),
              const SizedBox(height: 8),
              _ZoomButton(
                icon: Icons.remove,
                onTap: () => _controller?.animateCamera(CameraUpdate.zoomOut()),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<Set<Annotation>> _buildAnnotations(List<Station> withPrice) async {
    // Pre-load all logos in parallel
    final brands = widget.stations
        .where((s) => s.prices[widget.fuelType] != null)
        .map((s) => s.brand)
        .toSet();
    await Future.wait(brands.map(_loadLogo));

    final annotations = <Annotation>{};
    for (final station in widget.stations) {
      final price = station.prices[widget.fuelType];
      if (price == null) continue;

      final priceText = formatPrice(price, widget.currency);
      final color =
          shared.getStationColor(station, widget.fuelType, withPrice);
      final icon = await _getPinIcon(station, priceText, color);

      annotations.add(Annotation(
        annotationId: AnnotationId(station.id),
        position: LatLng(station.lat, station.lng),
        icon: icon,
        onTap: () => widget.onStationTap?.call(station),
      ));
    }
    return annotations;
  }
}

class _ZoomButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _ZoomButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 2,
      borderRadius: BorderRadius.circular(8),
      color: Colors.white,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 22, color: Colors.black87),
        ),
      ),
    );
  }
}
