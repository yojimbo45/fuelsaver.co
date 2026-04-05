import 'package:dio/dio.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import 'demo_fetcher.dart';

final _dio = Dio();

Future<List<Station>> fetchMexico(
    double lat, double lng, double radiusKm, String fuelType) async {
  List<dynamic> list;
  try {
    final res = await _dio.get(
        'https://api.datos.gob.mx/v1/precios.gasolinas.gasolinerias');
    list = (res.data?['results'] as List?) ?? [];
  } catch (_) {
    return generateDemoStations(lat, lng, radiusKm, 'MX');
  }

  final stations = <Station>[];
  for (final s in list) {
    final sLat = double.tryParse((s['latitud'] ?? s['y'])?.toString() ?? '');
    final sLng = double.tryParse((s['longitud'] ?? s['x'])?.toString() ?? '');
    if (sLat == null || sLng == null) continue;

    final dist = haversineDistance(lat, lng, sLat, sLng);
    if (dist > radiusKm) continue;

    final prices = <String, double>{};
    final reg = s['precio_regular'] ?? s['regular'];
    final prem = s['precio_premium'] ?? s['premium'];
    final diesel = s['precio_diesel'] ?? s['diesel'];
    if (reg != null) prices['regular'] = double.parse(reg.toString());
    if (prem != null) prices['premium'] = double.parse(prem.toString());
    if (diesel != null) prices['diesel'] = double.parse(diesel.toString());

    stations.add(Station(
      id: 'MX-${s['place_id'] ?? s['_id'] ?? stations.length}',
      brand: (s['razonsocial'] ?? s['permisionario'])?.toString() ?? 'Gasolinera',
      address: (s['direccion'] ?? s['calle'])?.toString() ?? '',
      city: s['municipio']?.toString() ?? '',
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
