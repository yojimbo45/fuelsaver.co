import 'package:dio/dio.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchArgentina(
    double lat, double lng, double radiusKm, String fuelType) async {
  List<dynamic> list;
  try {
    final res = await _dio.get(
        'https://datos.gob.ar/api/3/action/datastore_search?resource_id=energia-precios-surtidor&limit=1000');
    list = (res.data?['result']?['records'] as List?) ?? [];
  } catch (_) {
    return generateDemoStations(lat, lng, radiusKm, 'AR');
  }

  final stations = <Station>[];
  for (final s in list) {
    final sLat =
        double.tryParse((s['latitud'] ?? s['lat'])?.toString() ?? '');
    final sLng = double.tryParse(
        (s['longitud'] ?? s['lng'] ?? s['lon'])?.toString() ?? '');
    if (sLat == null || sLng == null) continue;

    final dist = haversineDistance(lat, lng, sLat, sLng);
    if (dist > radiusKm) continue;

    final prices = <String, double>{};
    if (s['nafta_super'] != null) prices['nafta_super'] = double.parse(s['nafta_super'].toString());
    if (s['nafta_premium'] != null) prices['nafta_premium'] = double.parse(s['nafta_premium'].toString());
    final diesel = s['diesel'] ?? s['gasoil'];
    if (diesel != null) prices['diesel'] = double.parse(diesel.toString());
    if (s['diesel_premium'] != null) prices['diesel_premium'] = double.parse(s['diesel_premium'].toString());
    if (s['gnc'] != null) prices['gnc'] = double.parse(s['gnc'].toString());

    stations.add(Station(
      id: 'AR-${s['id_estacion'] ?? s['_id'] ?? stations.length}',
      brand: (s['empresa'] ?? s['bandera'])?.toString() ?? 'Estación',
      address: s['direccion']?.toString() ?? '',
      city: (s['localidad'] ?? s['municipio'])?.toString() ?? '',
      lat: sLat,
      lng: sLng,
      prices: prices,
      updatedAt: s['fecha']?.toString(),
      distance: dist,
    ));
  }

  stations.sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
  return stations.take(100).toList();
}
