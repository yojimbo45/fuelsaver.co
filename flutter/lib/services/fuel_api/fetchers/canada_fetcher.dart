import 'package:dio/dio.dart';
import '../../../config/env.dart';
import '../../../models/station.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchCanada(
    double lat, double lng, double radiusKm, String fuelType) async {
  final workerUrl = Env.canadaWorkerUrl;
  if (workerUrl.isEmpty) return generateDemoStations(lat, lng, radiusKm, 'CA');

  try {
    final res = await _dio.get(
        '$workerUrl/api/canada?lat=$lat&lng=$lng&radius=$radiusKm');
    final list = (res.data?['stations'] as List?) ?? [];
    return list
        .map<Station>((s) => Station(
              id: s['id']?.toString() ?? '',
              brand: s['brand']?.toString() ?? '',
              address: s['address']?.toString() ?? '',
              city: s['city']?.toString() ?? '',
              lat: (s['lat'] as num).toDouble(),
              lng: (s['lng'] as num).toDouble(),
              prices: (s['prices'] as Map<String, dynamic>?)
                      ?.map((k, v) => MapEntry(k, (v as num).toDouble())) ??
                  {},
              updatedAt: s['updatedAt']?.toString(),
              distance: (s['distance'] as num?)?.toDouble(),
            ))
        .toList();
  } catch (_) {
    return generateDemoStations(lat, lng, radiusKm, 'CA');
  }
}
