import 'package:dio/dio.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchChile(
    double lat, double lng, double radiusKm, String fuelType) async {
  List<dynamic> list;
  try {
    final res =
        await _dio.get('https://api.cne.cl/v3/combustibles/vehicular/estaciones');
    list = res.data?['data'] ?? res.data ?? [];
  } catch (_) {
    return generateDemoStations(lat, lng, radiusKm, 'CL');
  }

  final stations = <Station>[];
  for (final s in list) {
    final sLat = double.tryParse((s['latitud'] ?? s['lat'])?.toString() ?? '');
    final sLng = double.tryParse(
        (s['longitud'] ?? s['lng'] ?? s['lon'])?.toString() ?? '');
    if (sLat == null || sLng == null) continue;

    final dist = haversineDistance(lat, lng, sLat, sLng);
    if (dist > radiusKm) continue;

    final prices = <String, double>{};
    if (s['gasolina_93'] != null) prices['gasolina93'] = double.parse(s['gasolina_93'].toString());
    if (s['gasolina_95'] != null) prices['gasolina95'] = double.parse(s['gasolina_95'].toString());
    if (s['gasolina_97'] != null) prices['gasolina97'] = double.parse(s['gasolina_97'].toString());
    final diesel = s['diesel'] ?? s['petroleo_diesel'];
    if (diesel != null) prices['diesel'] = double.parse(diesel.toString());
    final glp = s['glp'] ?? s['glp_vehicular'];
    if (glp != null) prices['glp'] = double.parse(glp.toString());

    stations.add(Station(
      id: 'CL-${s['id'] ?? s['id_estacion'] ?? stations.length}',
      brand: (s['distribuidor'] ?? s['nombre_distribuidor'])?.toString() ?? 'Estación',
      address: (s['direccion_calle'] ?? s['direccion'])?.toString() ?? '',
      city: (s['comuna'] ?? s['nombre_comuna'])?.toString() ?? '',
      lat: sLat,
      lng: sLng,
      prices: prices,
      updatedAt: s['fecha_actualizacion']?.toString(),
      distance: dist,
    ));
  }

  stations.sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
  return stations.take(100).toList();
}
