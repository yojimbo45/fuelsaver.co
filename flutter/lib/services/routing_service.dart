import 'package:dio/dio.dart';
import '../models/trip_models.dart';

final _dio = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 15),
  receiveTimeout: const Duration(seconds: 15),
));

/// Fetch a driving route between points using OSRM.
Future<TripRoute> fetchRoute(List<TripPlace> points) async {
  if (points.length < 2) throw Exception('At least 2 points required');

  final coords = points.map((p) => '${p.lng},${p.lat}').join(';');
  final url =
      'https://router.project-osrm.org/route/v1/driving/$coords?overview=simplified&geometries=geojson&steps=false';

  final res = await _dio.get(url);
  final json = res.data as Map<String, dynamic>;

  if (json['code'] != 'Ok') throw Exception('No route found');
  final routes = json['routes'] as List?;
  if (routes == null || routes.isEmpty) throw Exception('No route found');

  final route = routes[0] as Map<String, dynamic>;
  return TripRoute(
    geometry: route['geometry'] as Map<String, dynamic>,
    distance: (route['distance'] as num).toDouble() / 1000, // m → km
    duration: (route['duration'] as num).toDouble(), // seconds
  );
}
