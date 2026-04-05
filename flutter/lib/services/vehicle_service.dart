import 'package:dio/dio.dart';
import '../config/env.dart';
import '../models/trip_models.dart';

final _dio = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 10),
));

/// Search vehicles by query string.
Future<List<Vehicle>> searchVehicles(String query) async {
  if (query.length < 2) return [];

  final workerUrl = Env.workerUrl;
  if (workerUrl.isEmpty) return [];

  try {
    final res = await _dio.get('$workerUrl/api/vehicles',
        queryParameters: {'q': query});
    final vehicles = (res.data['vehicles'] as List?) ?? [];
    return vehicles
        .map<Vehicle>((v) => Vehicle.fromJson(v as Map<String, dynamic>))
        .toList();
  } catch (_) {
    return [];
  }
}
