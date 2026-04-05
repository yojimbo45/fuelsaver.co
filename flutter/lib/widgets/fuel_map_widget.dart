import 'dart:io' show Platform;
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/station.dart';
import '../models/search_params.dart';
import '../utils/geo.dart';

// Platform-specific imports
import 'fuel_map_maplibre.dart' as maplibre_map;
import 'fuel_map_apple.dart' as apple_map;

class MapTarget {
  final double lat;
  final double lng;
  MapTarget(this.lat, this.lng);
}

class FuelMapWidget extends StatelessWidget {
  final double centerLat;
  final double centerLng;
  final double zoom;
  final List<Station> stations;
  final String fuelType;
  final String currency;
  final SearchParams? searchCenter;
  final Station? highlightedStation;
  final MapTarget? flyToTarget;
  final void Function(Station station)? onStationTap;
  final void Function(double lat, double lng, double radiusKm)? onRegionChanged;

  const FuelMapWidget({
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
  Widget build(BuildContext context) {
    if (!kIsWeb && Platform.isIOS) {
      return apple_map.AppleFuelMap(
        centerLat: centerLat,
        centerLng: centerLng,
        zoom: zoom,
        stations: stations,
        fuelType: fuelType,
        currency: currency,
        searchCenter: searchCenter,
        highlightedStation: highlightedStation,
        flyToTarget: flyToTarget,
        onStationTap: onStationTap,
        onRegionChanged: onRegionChanged,
      );
    }

    return maplibre_map.MapLibreFuelMap(
      centerLat: centerLat,
      centerLng: centerLng,
      zoom: zoom,
      stations: stations,
      fuelType: fuelType,
      currency: currency,
      searchCenter: searchCenter,
      highlightedStation: highlightedStation,
      flyToTarget: flyToTarget,
      onStationTap: onStationTap,
      onRegionChanged: onRegionChanged,
    );
  }
}

// Shared utilities used by both platform implementations

Color getStationColor(
    Station station, String fuelType, List<Station> withPrice) {
  final price = station.prices[fuelType];
  if (price == null || withPrice.length <= 1) return AppTheme.primaryOrange;

  final minP = withPrice.first.prices[fuelType]!;
  final maxP = withPrice.last.prices[fuelType]!;
  final range = maxP - minP;
  if (range <= 0) return AppTheme.primaryOrange;

  final ratio = (price - minP) / range;
  if (ratio < 0.25) return AppTheme.greenCheap;
  if (ratio > 0.75) return AppTheme.redExpensive;
  return AppTheme.primaryOrange;
}

List<Station> sortedByPrice(List<Station> stations, String fuelType) {
  return stations
      .where((s) => s.prices[fuelType] != null)
      .toList()
    ..sort(
        (a, b) => a.prices[fuelType]!.compareTo(b.prices[fuelType]!));
}

Future<ui.Image> renderMarkerIcon(Color color, {double size = 96}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);

  canvas.drawCircle(
    Offset(size / 2, size / 2),
    size / 2 - 3,
    Paint()..color = color,
  );
  canvas.drawCircle(
    Offset(size / 2, size / 2),
    size / 2 - 3,
    Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3,
  );
  final iconPaint = Paint()
    ..color = Colors.white
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2.5
    ..strokeCap = StrokeCap.round;

  canvas.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(size * 0.3125, size * 0.2917, size * 0.25, size * 0.333),
      const Radius.circular(2),
    ),
    Paint()..color = Colors.white,
  );
  canvas.drawLine(
      Offset(size * 0.5625, size * 0.375),
      Offset(size * 0.667, size * 0.3125),
      iconPaint);
  canvas.drawLine(
      Offset(size * 0.667, size * 0.3125),
      Offset(size * 0.667, size * 0.5417),
      iconPaint);

  canvas.drawRect(
    Rect.fromLTWH(size * 0.354, size * 0.333, size * 0.167, size * 0.104),
    Paint()..color = color.withValues(alpha: 0.5),
  );

  final picture = recorder.endRecording();
  return picture.toImage(size.toInt(), size.toInt());
}

/// Renders a pin-style marker: colored circle with brand logo (or letter
/// fallback) on top, colored ribbon with price below, arrow at bottom.
Future<Uint8List> renderPinMarkerIcon({
  required String priceText,
  required String brandLetter,
  required Color accentColor,
  ui.Image? logoImage,
  double pixelRatio = 3.0,
}) async {
  final r = pixelRatio;

  // Measure price text
  final textPainter = TextPainter(
    text: TextSpan(
      text: priceText,
      style: TextStyle(
        fontSize: 13 * r,
        fontWeight: FontWeight.bold,
        color: Colors.white,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  // Brand letter painter (fallback when no logo)
  final letterPainter = TextPainter(
    text: TextSpan(
      text: brandLetter,
      style: TextStyle(
        fontSize: 32 * r,
        fontWeight: FontWeight.bold,
        color: const Color(0xFF9CA3AF),
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  // Pin dimensions — 2x the original size
  final logoSize = 80 * r;
  final border = 6 * r;
  final ribbonPadX = 12 * r;
  final ribbonPadY = 5 * r;
  final ribbonRadius = 6 * r;
  final arrowH = 12 * r;
  final pinGap = -4 * r;

  final logoOuterR = logoSize / 2 + border;
  final ribbonW = ribbonPadX + textPainter.width + ribbonPadX;
  final ribbonH = ribbonPadY * 2 + textPainter.height;
  final totalW = max(logoOuterR * 2, ribbonW);
  final totalH = logoOuterR * 2 + pinGap + ribbonH + arrowH;

  // Round up to even dimensions (Android GPU compatibility)
  final canvasW = (totalW.ceil() + 1) & ~1;
  final canvasH = (totalH.ceil() + 1) & ~1;

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);

  final cx = totalW / 2;
  final logoCY = logoOuterR;
  final logoR = logoSize / 2;

  // --- Logo circle: colored border ---
  canvas.drawCircle(Offset(cx, logoCY), logoOuterR, Paint()..color = accentColor);

  // --- Logo circle: white fill ---
  canvas.drawCircle(Offset(cx, logoCY), logoR, Paint()..color = Colors.white);

  // --- Logo image or brand letter ---
  if (logoImage != null) {
    canvas.save();
    canvas.clipPath(Path()..addOval(
      Rect.fromCircle(center: Offset(cx, logoCY), radius: logoR * 0.85),
    ));
    final iw = logoImage.width.toDouble();
    final ih = logoImage.height.toDouble();
    final scale = min((logoR * 1.7) / iw, (logoR * 1.7) / ih);
    final sw = iw * scale;
    final sh = ih * scale;
    paintImage(
      canvas: canvas,
      rect: Rect.fromCenter(center: Offset(cx, logoCY), width: sw, height: sh),
      image: logoImage,
      filterQuality: FilterQuality.high,
    );
    canvas.restore();
  } else {
    letterPainter.paint(
      canvas,
      Offset(cx - letterPainter.width / 2, logoCY - letterPainter.height / 2),
    );
  }

  // --- Ribbon background (rounded rect) ---
  final ribbonY = logoCY + logoOuterR + pinGap;
  final ribbonX = (totalW - ribbonW) / 2;
  canvas.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(ribbonX, ribbonY, ribbonW, ribbonH),
      Radius.circular(ribbonRadius),
    ),
    Paint()..color = accentColor,
  );

  // --- Price text centered in ribbon ---
  textPainter.paint(
    canvas,
    Offset(cx - textPainter.width / 2, ribbonY + ribbonPadY),
  );

  // --- Arrow pointer ---
  final arrowY = ribbonY + ribbonH;
  canvas.drawPath(
    Path()
      ..moveTo(cx - 8 * r, arrowY)
      ..lineTo(cx + 8 * r, arrowY)
      ..lineTo(cx, arrowY + arrowH)
      ..close(),
    Paint()..color = accentColor,
  );

  final picture = recorder.endRecording();
  final image = await picture.toImage(canvasW, canvasH);
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  return byteData!.buffer.asUint8List();
}

({double minLat, double maxLat, double minLng, double maxLng})
    computeBounds(SearchParams sc) {
  final points = createCirclePoints(sc.lat, sc.lng, sc.radiusKm);
  var minLat = points.first['lat']!;
  var maxLat = points.first['lat']!;
  var minLng = points.first['lng']!;
  var maxLng = points.first['lng']!;
  for (final p in points) {
    minLat = min(minLat, p['lat']!);
    maxLat = max(maxLat, p['lat']!);
    minLng = min(minLng, p['lng']!);
    maxLng = max(maxLng, p['lng']!);
  }
  return (minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng);
}

/// Compute radius in km from map visible bounds
double haversineFromBounds(
    double swLat, double swLng, double neLat, double neLng) {
  final centerLat = (swLat + neLat) / 2;
  final centerLng = (swLng + neLng) / 2;
  return haversineDistance(centerLat, centerLng, neLat, neLng);
}

class ZoomButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const ZoomButton({super.key, required this.icon, required this.onTap});

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
