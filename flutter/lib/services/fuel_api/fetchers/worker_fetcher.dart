import 'dart:math';
import 'package:dio/dio.dart';
import '../../../config/env.dart';
import '../../../models/station.dart';

final _dio = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 15),
  receiveTimeout: const Duration(seconds: 15),
));

// ─── Response cache (5-min TTL, max 30 entries) ───────────────────
const _cacheTtl = Duration(minutes: 5);
const _cacheMax = 30;
final _cache = <String, ({List<Station> data, DateTime ts})>{};

String _cacheKey(String cc, double lat, double lng, double radius, String ft) =>
    '$cc:${lat.toStringAsFixed(2)}:${lng.toStringAsFixed(2)}:${(radius / 5).round() * 5}:$ft';

/// Fetches stations from the unified Cloudflare Worker API
/// at api.fuelsaver.one/api/{countryCode}.
Future<List<Station>> fetchFromWorker(
  String countryCode,
  double lat,
  double lng,
  double radiusKm,
  String fuelType,
) async {
  final baseUrl = Env.workerUrl;
  if (baseUrl.isEmpty) {
    throw Exception('WORKER_URL not configured');
  }

  // Check cache
  final key = _cacheKey(countryCode, lat, lng, radiusKm, fuelType);
  final cached = _cache[key];
  if (cached != null && DateTime.now().difference(cached.ts) < _cacheTtl) {
    return cached.data;
  }

  final uri = Uri.parse('$baseUrl/api/${countryCode.toLowerCase()}').replace(
    queryParameters: {
      'lat': lat.toStringAsFixed(4),
      'lng': lng.toStringAsFixed(4),
      'radius': '${min(radiusKm.round(), 2000)}',
      'spread': 'true',
      if (fuelType.isNotEmpty) 'fuelType': fuelType,
    },
  );

  Response response;
  try {
    response = await _dio.getUri(uri);
  } catch (e) {
    // Retry once on timeout
    await Future.delayed(const Duration(seconds: 1));
    response = await _dio.getUri(uri);
  }

  if (response.statusCode == 503) {
    // Data not cached yet – retry once
    await Future.delayed(const Duration(seconds: 1));
    response = await _dio.getUri(uri);
  }

  final data = response.data as Map<String, dynamic>;
  final rawStations = data['stations'] as List? ?? [];

  final stations = rawStations
      .map((s) => Station.fromJson(s as Map<String, dynamic>))
      .toList();

  // Store in cache (evict oldest if full)
  if (_cache.length >= _cacheMax) {
    _cache.remove(_cache.keys.first);
  }
  _cache[key] = (data: stations, ts: DateTime.now());

  return stations;
}
