import 'package:dio/dio.dart';
import '../../../config/env.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchSwitzerland(
    double lat, double lng, double radiusKm, String fuelType) async {
  final proxyUrl = Env.switzerlandProxyUrl;
  if (proxyUrl.isEmpty) return generateDemoStations(lat, lng, radiusKm, 'CH');

  try {
    final res = await _dio
        .get('$proxyUrl/api/switzerland?lat=$lat&lng=$lng&radius=$radiusKm');
    final list =
        (res.data?['stations'] ?? res.data?['data'] ?? res.data) as List? ??
            [];

    final stations = <Station>[];
    for (final s in list) {
      final sLat = double.tryParse(
          (s['latitude'] ?? s['lat'] ?? s['location']?['latitude'])
                  ?.toString() ??
              '');
      final sLng = double.tryParse(
          (s['longitude'] ?? s['lng'] ?? s['location']?['longitude'])
                  ?.toString() ??
              '');
      if (sLat == null || sLng == null) continue;

      final dist = haversineDistance(lat, lng, sLat, sLng);
      if (dist > radiusKm) continue;

      final prices = <String, double>{};
      if (s['fuelCollection'] is List) {
        for (final f in s['fuelCollection']) {
          final price =
              double.tryParse((f['displayPrice'] ?? f['price'])?.toString() ?? '');
          if (price == null) continue;
          final name = (f['fuelType'] ?? f['name'] ?? '').toString().toLowerCase();
          if (name.contains('95')) {
            prices['E95'] = price;
          } else if (name.contains('98')) {
            prices['E98'] = price;
          } else if (name.contains('diesel')) {
            prices['Diesel'] = price;
          }
        }
      }
      if (s['E95'] != null) prices['E95'] = double.parse(s['E95'].toString());
      if (s['E98'] != null) prices['E98'] = double.parse(s['E98'].toString());
      if (s['Diesel'] != null) prices['Diesel'] = double.parse(s['Diesel'].toString());

      stations.add(Station(
        id: 'CH-${s['id'] ?? stations.length}',
        brand: (s['brand'] ?? s['displayName'] ?? s['name'])?.toString() ?? 'Tankstelle',
        address: (s['formattedAddress'] ?? s['address'])?.toString() ?? '',
        city: s['city']?.toString() ?? '',
        lat: sLat,
        lng: sLng,
        prices: prices,
        updatedAt: (s['updatedAt'] ?? s['lastUpdate'])?.toString(),
        distance: dist,
      ));
    }

    stations.sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
    return stations.take(100).toList();
  } catch (_) {
    return generateDemoStations(lat, lng, radiusKm, 'CH');
  }
}
