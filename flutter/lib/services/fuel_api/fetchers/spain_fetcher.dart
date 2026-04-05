import 'package:dio/dio.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';

final _dio = Dio();

double? _parseSpanishNum(dynamic v) {
  if (v == null) return null;
  final n = double.tryParse(v.toString().replaceAll(',', '.'));
  return (n != null && !n.isNaN) ? n : null;
}

Future<List<Station>> fetchSpain(
    double lat, double lng, double radiusKm, String fuelType) async {
  final res = await _dio.get(
    'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
  );

  final list = (res.data['ListaEESSPrecio'] as List?) ?? [];
  final stations = <Station>[];

  for (final s in list) {
    final sLat = _parseSpanishNum(s['Latitud']);
    final sLng = _parseSpanishNum(s['Longitud (WGS84)'] ?? s['Longitud']);
    if (sLat == null || sLng == null) continue;

    final dist = haversineDistance(lat, lng, sLat, sLng);
    if (dist > radiusKm) continue;

    final prices = <String, double>{};
    final g95 = _parseSpanishNum(s['Precio Gasolina 95 E5']);
    final g98 = _parseSpanishNum(s['Precio Gasolina 98 E5']);
    final gasA = _parseSpanishNum(s['Precio Gasoleo A']);
    final glp = _parseSpanishNum(s['Precio Gases licuados del petróleo']);
    if (g95 != null) prices['gasolina95'] = g95;
    if (g98 != null) prices['gasolina98'] = g98;
    if (gasA != null) prices['gasoleo'] = gasA;
    if (glp != null) prices['glp'] = glp;

    stations.add(Station(
      id: 'ES-${s['IDEESS']}',
      brand: s['Rótulo']?.toString() ?? 'Gasolinera',
      address: s['Dirección']?.toString() ?? '',
      city: s['Municipio']?.toString() ?? '',
      lat: sLat,
      lng: sLng,
      prices: prices,
      distance: dist,
    ));
  }

  stations.sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
  return stations.take(100).toList();
}
