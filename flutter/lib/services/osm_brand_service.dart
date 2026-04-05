import 'dart:math';
import 'package:dio/dio.dart';
import '../utils/geo.dart';

final _dio = Dio();

class OsmStation {
  final String? brand;
  final double lat;
  final double lng;
  final String? openingHours;
  final String? phone;
  final String? website;
  final List<String> payment;
  final bool carWash;
  final bool compressedAir;
  final bool shop;

  OsmStation({
    this.brand,
    required this.lat,
    required this.lng,
    this.openingHours,
    this.phone,
    this.website,
    this.payment = const [],
    this.carWash = false,
    this.compressedAir = false,
    this.shop = false,
  });
}

Future<List<OsmStation>> fetchOSMStations(
    double lat, double lng, double radiusKm) async {
  try {
    final radiusM = min(radiusKm * 1000, 50000).toInt();
    final query =
        '[out:json][timeout:10];(node[amenity=fuel](around:$radiusM,$lat,$lng);way[amenity=fuel](around:$radiusM,$lat,$lng););out center 200;';

    final res = await _dio.post(
      'https://overpass-api.de/api/interpreter',
      data: 'data=${Uri.encodeComponent(query)}',
      options: Options(
        contentType: 'application/x-www-form-urlencoded',
      ),
    );
    final elements = (res.data['elements'] as List?) ?? [];
    return elements.map<OsmStation?>((e) {
      final t = (e['tags'] as Map<String, dynamic>?) ?? {};
      final eLat = (e['lat'] ?? e['center']?['lat']) as num?;
      final eLng = (e['lon'] ?? e['center']?['lon']) as num?;
      if (eLat == null) return null;

      final payment = (t.keys)
          .where((k) => k.startsWith('payment:') && t[k] == 'yes')
          .map((k) => k.replaceFirst('payment:', ''))
          .toList();

      return OsmStation(
        brand: t['brand'] ?? t['operator'] ?? t['name'],
        lat: eLat.toDouble(),
        lng: (eLng ?? 0).toDouble(),
        openingHours: t['opening_hours'],
        phone: t['phone'] ?? t['contact:phone'],
        website: t['website'] ?? t['contact:website'],
        payment: payment,
        carWash: t['car_wash'] == 'yes',
        compressedAir: t['compressed_air'] == 'yes',
        shop: t['shop'] != null,
      );
    }).whereType<OsmStation>().toList();
  } catch (_) {
    return [];
  }
}

String? matchOSMBrand(
    List<OsmStation> osmStations, double stationLat, double stationLng) {
  OsmStation? best;
  var bestDist = 0.15; // 150m
  for (final s in osmStations) {
    final d = haversineDistance(stationLat, stationLng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best?.brand;
}
