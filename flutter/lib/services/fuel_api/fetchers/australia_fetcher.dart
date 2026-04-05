import 'dart:convert';
import 'dart:math';
import 'package:dio/dio.dart';
import '../../../config/env.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchAustralia(
    double lat, double lng, double radiusKm, String fuelType) async {
  final apiKey = Env.fuelcheckNswKey;
  if (apiKey.isEmpty) return generateDemoStations(lat, lng, radiusKm, 'AU');

  final secret = Env.fuelcheckNswSecret;
  final basicAuth = base64Encode(utf8.encode('$apiKey:$secret'));

  final res = await _dio.post(
    'https://api.onegov.nsw.gov.au/FuelCheckApp/v2/fuel/prices/nearby',
    data: {
      'fuelType': fuelType.isNotEmpty ? fuelType : 'E10',
      'latitude': lat,
      'longitude': lng,
      'radius': min(radiusKm, 50.0),
      'sortBy': 'distance',
      'sortAscending': true,
    },
    options: Options(headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic $basicAuth',
      'apikey': apiKey,
    }),
  );

  final list =
      (res.data?['prices'] ?? res.data?['stations'] ?? res.data) as List? ?? [];

  return list.map<Station?>((s) {
    final sLat = (s['location']?['latitude'] ?? s['latitude'] ?? s['lat'])
        as num?;
    final sLng = (s['location']?['longitude'] ?? s['longitude'] ?? s['lng'])
        as num?;
    if (sLat == null || sLng == null) return null;

    final prices = <String, double>{};
    if (s['price'] != null) {
      prices[s['fuelType']?.toString() ?? fuelType] =
          (s['price'] as num).toDouble();
    }
    if (s['prices'] is List) {
      for (final p in s['prices']) {
        if (p['fuelType'] != null && p['price'] != null) {
          prices[p['fuelType'].toString()] = (p['price'] as num).toDouble();
        }
      }
    }

    return Station(
      id: 'AU-${s['stationCode'] ?? s['serviceStationId'] ?? s['id'] ?? ''}',
      brand: (s['brand'] ?? s['stationName'])?.toString() ?? 'Station',
      address: s['address']?.toString() ?? '',
      city: (s['suburb'] ?? s['location']?['suburb'])?.toString() ?? '',
      lat: sLat.toDouble(),
      lng: sLng.toDouble(),
      prices: prices,
      updatedAt: (s['lastupdated'] ?? s['priceUpdatedDate'])?.toString(),
      distance: haversineDistance(lat, lng, sLat.toDouble(), sLng.toDouble()),
    );
  }).whereType<Station>().toList()
    ..sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
}
