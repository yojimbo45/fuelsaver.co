import 'package:dio/dio.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';

final _dio = Dio();

Future<List<Station>> fetchAustria(
    double lat, double lng, double radiusKm, String fuelType) async {
  const validTypes = ['SUP', 'GOE', 'GAS'];
  final ft = validTypes.contains(fuelType) ? fuelType : 'SUP';

  final res = await _dio.get(
    'https://api.e-control.at/sprit/1.0/search/gas-stations/by-address',
    queryParameters: {
      'latitude': lat,
      'longitude': lng,
      'fuelType': ft,
      'includeClosed': 'false',
    },
  );

  final list = (res.data as List?) ?? [];
  final stations = <Station>[];

  for (final s in list) {
    final sLat = (s['location']?['latitude'] as num?)?.toDouble();
    final sLng = (s['location']?['longitude'] as num?)?.toDouble();
    if (sLat == null || sLng == null) continue;

    final dist = haversineDistance(lat, lng, sLat, sLng);
    if (dist > radiusKm) continue;

    final prices = <String, double>{};
    for (final p in (s['prices'] as List?) ?? []) {
      if (p['fuelType'] != null && p['amount'] != null) {
        prices[p['fuelType'].toString()] = (p['amount'] as num).toDouble();
      }
    }

    stations.add(Station(
      id: 'AT-${s['id']}',
      brand: s['name']?.toString() ?? 'Tankstelle',
      address: s['location']?['address']?.toString() ?? '',
      city:
          '${s['location']?['postalCode'] ?? ''} ${s['location']?['city'] ?? ''}'
              .trim(),
      lat: sLat,
      lng: sLng,
      prices: prices,
      distance: dist,
    ));
  }

  stations.sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
  return stations.take(100).toList();
}
