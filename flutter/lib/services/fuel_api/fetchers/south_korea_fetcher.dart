import 'dart:math';
import 'package:dio/dio.dart';
import '../../../config/env.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchSouthKorea(
    double lat, double lng, double radiusKm, String fuelType) async {
  final apiKey = Env.opinetKey;
  if (apiKey.isEmpty) return generateDemoStations(lat, lng, radiusKm, 'KR');

  final radiusM = min(radiusKm * 1000, 5000.0).toInt();
  final res = await _dio.get(
    'https://www.opinet.co.kr/api/aroundAll.do',
    queryParameters: {
      'code': apiKey,
      'x': lng,
      'y': lat,
      'radius': radiusM,
      'sort': '2',
      'prodcd': 'B027',
      'out': 'json',
    },
  );

  final list = (res.data?['RESULT']?['OIL'] as List?) ?? [];
  return list.map<Station?>((s) {
    final sLat = double.tryParse(s['GIS_Y_COOR']?.toString() ?? '');
    final sLng = double.tryParse(s['GIS_X_COOR']?.toString() ?? '');
    if (sLat == null || sLng == null) return null;

    final prices = <String, double>{};
    if (s['PRICE'] != null) {
      prices[s['PRODCD']?.toString() ?? 'B027'] =
          (s['PRICE'] as num).toDouble();
    }

    final dist = s['DISTANCE'] != null
        ? (s['DISTANCE'] as num).toDouble() / 1000
        : haversineDistance(lat, lng, sLat, sLng);

    return Station(
      id: 'KR-${s['UNI_ID']}',
      brand: s['POLL_DIV_CO']?.toString() ?? 'Station',
      address: (s['NEW_ADR'] ?? s['VAN_ADR'])?.toString() ?? '',
      city: '',
      lat: sLat,
      lng: sLng,
      prices: prices,
      distance: dist,
    );
  }).whereType<Station>().take(100).toList();
}
