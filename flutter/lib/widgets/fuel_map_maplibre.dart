import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../config/env.dart';
import '../models/station.dart';
import '../models/search_params.dart';
import '../utils/brand_logo.dart';
import '../utils/format.dart';
import 'fuel_map_widget.dart' as shared;

class MapLibreFuelMap extends StatefulWidget {
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

  const MapLibreFuelMap({
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
  State<MapLibreFuelMap> createState() => _MapLibreFuelMapState();
}

class _MapLibreFuelMapState extends State<MapLibreFuelMap> {
  MapLibreMapController? _controller;
  bool _initialLoadDone = false;
  bool _styleLoaded = false;
  final Set<String> _registeredImages = {};
  final Map<String, Symbol> _symbols = {}; // stationId → Symbol
  final Map<String, String> _symbolIdToStationId = {}; // symbol.id → stationId

  // Concurrency guard to prevent overlapping async MapLibre operations
  bool _markersUpdating = false;
  bool _markersPending = false;

  // Cached style JSON (computed once)
  static String? _cachedStyleJson;
  static String get _styleJson {
    if (_cachedStyleJson != null) return _cachedStyleJson!;
    final token = Env.mapboxToken;
    final Map<String, dynamic> style;
    if (token.isNotEmpty) {
      style = {
        'version': 8,
        'sources': {
          'mapbox-streets': {
            'type': 'raster',
            'tiles': [
              'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=$token',
            ],
            'tileSize': 512,
            'attribution':
                '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        'layers': [
          {'id': 'mapbox-streets', 'type': 'raster', 'source': 'mapbox-streets'},
        ],
      };
    } else {
      style = {
        'version': 8,
        'sources': {
          'osm': {
            'type': 'raster',
            'tiles': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            'tileSize': 256,
            'attribution':
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        'layers': [
          {'id': 'osm-tiles', 'type': 'raster', 'source': 'osm', 'minzoom': 0, 'maxzoom': 19},
        ],
      };
    }
    _cachedStyleJson = jsonEncode(style);
    return _cachedStyleJson!;
  }

  @override
  void didUpdateWidget(MapLibreFuelMap old) {
    super.didUpdateWidget(old);
    if (widget.highlightedStation != null &&
        widget.highlightedStation != old.highlightedStation) {
      _controller?.animateCamera(CameraUpdate.newLatLngZoom(
        LatLng(widget.highlightedStation!.lat, widget.highlightedStation!.lng),
        14,
      ));
    }
    if (widget.flyToTarget != null && widget.flyToTarget != old.flyToTarget) {
      _controller?.animateCamera(CameraUpdate.newLatLngZoom(
        LatLng(widget.flyToTarget!.lat, widget.flyToTarget!.lng),
        14,
      ));
    }
    if (widget.stations != old.stations ||
        widget.fuelType != old.fuelType) {
      _updateMarkers();
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

  void _onMapCreated(MapLibreMapController controller) {
    _controller = controller;
    _controller!.onSymbolTapped.add(_onSymbolTapped);
  }

  void _onStyleLoaded() async {
    _styleLoaded = true;
    await _updateMarkers();
    if (!_initialLoadDone) {
      _initialLoadDone = true;
      Future.delayed(const Duration(milliseconds: 800), _onCameraIdle);
    }
  }

  void _onSymbolTapped(Symbol symbol) {
    final stationId = _symbolIdToStationId[symbol.id];
    if (stationId == null) return;
    final station =
        widget.stations.where((s) => s.id == stationId).firstOrNull;
    if (station != null) widget.onStationTap?.call(station);
  }

  static const _pixelRatio = 3.0;

  // Logo cache: brand name → decoded ui.Image (or null if failed)
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

  String _pinImageName(Station station, String priceText, Color color) {
    final brand = station.brand.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    return 'pin-${color.toARGB32()}-$brand-${priceText.replaceAll(RegExp(r'[^a-zA-Z0-9.]'), '_')}';
  }

  Future<void> _updateMarkers() async {
    if (_controller == null || !_styleLoaded) return;
    if (_markersUpdating) {
      _markersPending = true;
      return;
    }
    _markersUpdating = true;

    try {
    final withPrice = shared.sortedByPrice(widget.stations, widget.fuelType);

    // Build desired state: stationId → imageName
    final desired = <String, ({Station station, String imageName})>{};

    // Pre-load all logos in parallel
    final brands = widget.stations
        .where((s) => s.prices[widget.fuelType] != null)
        .map((s) => s.brand)
        .toSet();
    await Future.wait(brands.map(_loadLogo));

    for (final station in widget.stations) {
      final price = station.prices[widget.fuelType];
      if (price == null) continue;

      final priceText = formatPrice(price, widget.currency);
      final color =
          shared.getStationColor(station, widget.fuelType, withPrice);
      final imageName = _pinImageName(station, priceText, color);

      // Register pin image if new
      if (!_registeredImages.contains(imageName)) {
        final letter =
            station.brand.isNotEmpty ? station.brand[0].toUpperCase() : '?';
        final logo = _logoCache[station.brand];
        final bytes = await shared.renderPinMarkerIcon(
          priceText: priceText,
          brandLetter: letter,
          accentColor: color,
          logoImage: logo,
          pixelRatio: _pixelRatio,
        );
        await _controller!.addImage(imageName, bytes);
        _registeredImages.add(imageName);
      }

      desired[station.id] = (station: station, imageName: imageName);
    }

    // Diff: remove symbols no longer needed
    final toRemove = <String>[];
    for (final id in _symbols.keys) {
      if (!desired.containsKey(id)) toRemove.add(id);
    }
    if (toRemove.isNotEmpty) {
      final removeSymbols = toRemove.map((id) => _symbols[id]!).toList();
      await _controller!.removeSymbols(removeSymbols);
      for (final id in toRemove) {
        final sym = _symbols.remove(id);
        if (sym != null) _symbolIdToStationId.remove(sym.id);
      }
    }

    // Diff: add symbols for new stations only
    final toAdd = <({Station station, String imageName})>[];
    for (final entry in desired.entries) {
      if (!_symbols.containsKey(entry.key)) {
        toAdd.add(entry.value);
      }
    }

    if (toAdd.isNotEmpty) {
      final options = toAdd
          .map((p) => SymbolOptions(
                geometry: LatLng(p.station.lat, p.station.lng),
                iconImage: p.imageName,
                iconSize: 1.0 / _pixelRatio,
                iconAnchor: 'bottom',
              ))
          .toList();

      final symbols = await _controller!.addSymbols(options);
      for (var i = 0; i < symbols.length; i++) {
        _symbols[toAdd[i].station.id] = symbols[i];
        _symbolIdToStationId[symbols[i].id] = toAdd[i].station.id;
      }
    }

    // Prune tracking set to prevent unbounded growth.
    // Images stay in the native map (no removeImage API), but by pruning
    // the tracking set, we allow re-registration if the same name appears
    // again while keeping the set bounded.
    if (_registeredImages.length > 200) {
      final usedImages = desired.values.map((e) => e.imageName).toSet();
      _registeredImages.retainAll(usedImages);
    }
    } catch (_) {
      // Gracefully handle MapLibre native errors
    } finally {
      _markersUpdating = false;
      if (_markersPending && mounted) {
        _markersPending = false;
        _updateMarkers();
      }
    }
  }

  @override
  void dispose() {
    _controller?.onSymbolTapped.remove(_onSymbolTapped);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        MapLibreMap(
          styleString: _styleJson,
          initialCameraPosition: CameraPosition(
            target: LatLng(widget.centerLat, widget.centerLng),
            zoom: widget.zoom,
          ),
          onMapCreated: _onMapCreated,
          onStyleLoadedCallback: _onStyleLoaded,
          onCameraIdle: _onCameraIdle,
          myLocationEnabled: true,
          myLocationTrackingMode: MyLocationTrackingMode.none,
          attributionButtonPosition: AttributionButtonPosition.bottomLeft,
        ),
        Positioned(
          top: MediaQuery.of(context).padding.top + 12,
          right: 12,
          child: Column(
            children: [
              shared.ZoomButton(
                icon: Icons.add,
                onTap: () => _controller?.animateCamera(CameraUpdate.zoomIn()),
              ),
              const SizedBox(height: 8),
              shared.ZoomButton(
                icon: Icons.remove,
                onTap: () => _controller?.animateCamera(CameraUpdate.zoomOut()),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

