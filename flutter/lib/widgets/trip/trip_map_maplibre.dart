import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../../config/countries.dart';
import '../../config/env.dart';
import '../../models/trip_models.dart';
import '../../utils/format.dart';
import '../fuel_map_widget.dart' as shared;

class TripMapMaplibre extends StatefulWidget {
  final TripRoute? route;
  final List<TripStation> stations;
  final TripPlace? origin;
  final TripPlace? destination;
  final String fuelType;
  final ValueChanged<TripStation>? onStationTap;

  const TripMapMaplibre({
    super.key,
    this.route,
    required this.stations,
    this.origin,
    this.destination,
    required this.fuelType,
    this.onStationTap,
  });

  @override
  State<TripMapMaplibre> createState() => _TripMapMaplibreState();
}

class _TripMapMaplibreState extends State<TripMapMaplibre> {
  MapLibreMapController? _controller;
  bool _styleLoaded = false;
  final Set<String> _registeredImages = {};
  final Map<String, Symbol> _symbols = {};
  final Map<String, String> _symbolIdToStationId = {};
  final Map<String, String> _symbolImageNames = {}; // stationId → imageName
  bool _routeAdded = false;

  // Concurrency guards to prevent overlapping async MapLibre operations
  bool _routeUpdating = false;
  bool _routePending = false;
  bool _markersUpdating = false;
  bool _markersPending = false;

  static const _pixelRatio = 3.0;

  // Cached style JSON
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
          },
        },
        'layers': [
          {'id': 'osm-tiles', 'type': 'raster', 'source': 'osm'},
        ],
      };
    }
    _cachedStyleJson = jsonEncode(style);
    return _cachedStyleJson!;
  }

  @override
  void didUpdateWidget(TripMapMaplibre old) {
    super.didUpdateWidget(old);
    if (widget.route != old.route) {
      _updateRoute();
      _fitRouteBounds();
    }
    if (widget.stations != old.stations) {
      _updateMarkers();
    }
  }

  void _onMapCreated(MapLibreMapController controller) {
    _controller = controller;
    _controller!.onSymbolTapped.add(_onSymbolTapped);
  }

  void _onStyleLoaded() async {
    _styleLoaded = true;
    await _updateRoute();
    await _updateMarkers();
    _fitRouteBounds();
  }

  void _onSymbolTapped(Symbol symbol) {
    final stationId = _symbolIdToStationId[symbol.id];
    if (stationId == null) return;
    final station =
        widget.stations.where((s) => s.id == stationId).firstOrNull;
    if (station != null) widget.onStationTap?.call(station);
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
      left: 50,
      right: 50,
      top: 80,
      bottom: 300,
    ));
  }

  /// Simplify a coordinate list to at most [maxPoints] using uniform sampling,
  /// always keeping the first and last points.
  static List<dynamic> _simplifyCoords(List<dynamic> coords, int maxPoints) {
    if (coords.length <= maxPoints) return coords;
    final result = <dynamic>[coords.first];
    final step = (coords.length - 1) / (maxPoints - 1);
    for (var i = 1; i < maxPoints - 1; i++) {
      result.add(coords[(i * step).round()]);
    }
    result.add(coords.last);
    return result;
  }

  Future<void> _updateRoute() async {
    if (_controller == null || !_styleLoaded) return;
    if (_routeUpdating) {
      _routePending = true;
      return;
    }
    _routeUpdating = true;
    try {
      if (_routeAdded) {
        try {
          await _controller!.removeLayer('trip-route-line');
          await _controller!.removeSource('trip-route');
        } catch (_) {}
        _routeAdded = false;
      }

      if (widget.route == null) return;

      // Simplify geometry to avoid MapLibre native crash on large coordinate sets
      final rawCoords = widget.route!.geometry['coordinates'] as List? ?? [];
      final simplified = _simplifyCoords(rawCoords, 200);
      final geojson = {
        'type': 'Feature',
        'geometry': {
          'type': widget.route!.geometry['type'] ?? 'LineString',
          'coordinates': simplified,
        },
      };

      await _controller!.addSource(
        'trip-route',
        GeojsonSourceProperties(data: geojson),
      );
      await _controller!.addLineLayer(
        'trip-route',
        'trip-route-line',
        const LineLayerProperties(
          lineColor: '#F97316',
          lineWidth: 4,
          lineOpacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        ),
      );
      _routeAdded = true;
    } catch (_) {
      // Gracefully handle MapLibre native errors
    } finally {
      _routeUpdating = false;
      if (_routePending && mounted) {
        _routePending = false;
        _updateRoute();
      }
    }
  }

  String _pinImageName(TripStation station, Color color) {
    final brand =
        station.brand.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    final priceStr =
        station.price.toStringAsFixed(3).replaceAll('.', '_');
    return 'trip-pin-${color.toARGB32()}-$brand-$priceStr';
  }

  Future<void> _updateMarkers() async {
    if (_controller == null || !_styleLoaded) return;
    if (_markersUpdating) {
      _markersPending = true;
      return;
    }
    _markersUpdating = true;
    try {
      // Build desired state: stationId → (station, imageName)
      final desired = <String, ({TripStation station, String imageName})>{};

      if (widget.stations.isNotEmpty) {
        double minP = widget.stations.first.price;
        double maxP = widget.stations.first.price;
        for (final s in widget.stations) {
          if (s.price < minP) minP = s.price;
          if (s.price > maxP) maxP = s.price;
        }
        final range = maxP - minP;

        for (final station in widget.stations) {
          if (!mounted) return;

          Color color;
          if (range <= 0) {
            color = const Color(0xFFF97316);
          } else {
            final ratio = (station.price - minP) / range;
            if (ratio < 0.25) {
              color = const Color(0xFF22C55E);
            } else if (ratio > 0.75) {
              color = const Color(0xFFEF4444);
            } else {
              color = const Color(0xFFF97316);
            }
          }

          final imageName = _pinImageName(station, color);

          if (!_registeredImages.contains(imageName)) {
            final currency = countries[station.countryCode]?.currency ?? '€';
            final priceText = formatPrice(station.price, currency);
            final letter =
                station.brand.isNotEmpty ? station.brand[0].toUpperCase() : '?';
            try {
              final bytes = await shared.renderPinMarkerIcon(
                priceText: priceText,
                brandLetter: letter,
                accentColor: color,
                pixelRatio: _pixelRatio,
              );
              if (!mounted) return;
              await _controller!.addImage(imageName, bytes);
              _registeredImages.add(imageName);
            } catch (_) {
              continue;
            }
          }

          desired[station.id] = (station: station, imageName: imageName);
        }
      }

      // Diff: remove symbols no longer needed or whose image changed
      final toRemove = <String>[];
      for (final id in _symbols.keys) {
        if (!desired.containsKey(id) ||
            _symbolImageNames[id] != desired[id]!.imageName) {
          toRemove.add(id);
        }
      }
      if (toRemove.isNotEmpty) {
        final removeSymbols = toRemove.map((id) => _symbols[id]!).toList();
        try {
          await _controller!.removeSymbols(removeSymbols);
        } catch (_) {}
        for (final id in toRemove) {
          final sym = _symbols.remove(id);
          _symbolImageNames.remove(id);
          if (sym != null) _symbolIdToStationId.remove(sym.id);
        }
      }

      // Diff: add symbols for new stations only
      final toAdd = <({TripStation station, String imageName})>[];
      for (final entry in desired.entries) {
        if (!_symbols.containsKey(entry.key)) {
          toAdd.add(entry.value);
        }
      }

      if (toAdd.isNotEmpty && mounted) {
        final options = toAdd
            .map((p) => SymbolOptions(
                  geometry: LatLng(p.station.lat, p.station.lng),
                  iconImage: p.imageName,
                  iconSize: 1.0 / _pixelRatio,
                  iconAnchor: 'bottom',
                ))
            .toList();

        try {
          final symbols = await _controller!.addSymbols(options);
          for (var i = 0; i < symbols.length; i++) {
            _symbols[toAdd[i].station.id] = symbols[i];
            _symbolImageNames[toAdd[i].station.id] = toAdd[i].imageName;
            _symbolIdToStationId[symbols[i].id] = toAdd[i].station.id;
          }
        } catch (_) {}
      }

      // Prune tracking set to prevent unbounded growth
      if (_registeredImages.length > 200) {
        final usedImages = desired.values.map((e) => e.imageName).toSet();
        _registeredImages.retainAll(usedImages);
      }
    } finally {
      _markersUpdating = false;
      if (_markersPending && mounted) {
        _markersPending = false;
        _updateMarkers();
      }
    }
  }

  LatLng get _initialCenter {
    if (widget.origin != null) {
      return LatLng(widget.origin!.lat, widget.origin!.lng);
    }
    return const LatLng(46.6, 2.35);
  }

  @override
  void dispose() {
    _controller?.onSymbolTapped.remove(_onSymbolTapped);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MapLibreMap(
      styleString: _styleJson,
      initialCameraPosition: CameraPosition(
        target: _initialCenter,
        zoom: 5,
      ),
      onMapCreated: _onMapCreated,
      onStyleLoadedCallback: _onStyleLoaded,
      myLocationEnabled: true,
      myLocationTrackingMode: MyLocationTrackingMode.none,
      attributionButtonPosition: AttributionButtonPosition.bottomLeft,
    );
  }
}
