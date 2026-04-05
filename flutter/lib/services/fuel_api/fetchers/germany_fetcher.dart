import 'dart:math';
import 'package:dio/dio.dart';
import '../../../config/env.dart';
import '../../../models/station.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchGermany(
    double lat, double lng, double radiusKm, String fuelType) async {
  final apiKey = Env.tankerkoenigKey;
  if (apiKey.isEmpty) return generateDemoStations(lat, lng, radiusKm, 'DE');

  final rad = min(radiusKm, 25.0);
  final res = await _dio.get(
    'https://creativecommons.tankerkoenig.de/json/list.php',
    queryParameters: {
      'lat': lat,
      'lng': lng,
      'rad': rad,
      'sort': 'dist',
      'type': 'all',
      'apikey': apiKey,
    },
  );

  if (res.data['ok'] != true) {
    throw Exception(res.data['message'] ?? 'Tankerkönig error');
  }

  return ((res.data['stations'] as List?) ?? []).map<Station>((s) {
    final prices = <String, double>{};
    if (s['e5'] != null) prices['e5'] = (s['e5'] as num).toDouble();
    if (s['e10'] != null) prices['e10'] = (s['e10'] as num).toDouble();
    if (s['diesel'] != null) prices['diesel'] = (s['diesel'] as num).toDouble();

    return Station(
      id: 'DE-${s['id']}',
      brand: s['brand']?.toString() ?? 'Tankstelle',
      address: '${s['street'] ?? ''} ${s['houseNumber'] ?? ''}'.trim(),
      city: '${s['postCode'] ?? ''} ${s['place'] ?? ''}'.trim(),
      lat: (s['lat'] as num).toDouble(),
      lng: (s['lng'] as num).toDouble(),
      prices: prices,
      distance: (s['dist'] as num?)?.toDouble(),
    );
  }).toList();
}
