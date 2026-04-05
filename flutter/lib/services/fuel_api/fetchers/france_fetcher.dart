import 'package:dio/dio.dart';
import '../../../models/station.dart';
import '../../../utils/geo.dart';
import '../../osm_brand_service.dart';

final _dio = Dio();

Future<List<Station>> fetchFrance(
    double lat, double lng, double radiusKm, String fuelType) async {
  final url =
      'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

  final results = await Future.wait([
    _dio.get(url, queryParameters: {
      'limit': '100',
      'where': "distance(geom, geom'POINT($lng $lat)', ${radiusKm}km)",
      'order_by': "distance(geom, geom'POINT($lng $lat)')",
    }),
    fetchOSMStations(lat, lng, radiusKm),
  ]);

  final govRes = results[0] as Response;
  final osmBrands = results[1] as List<OsmStation>;
  final records = (govRes.data['results'] as List?) ?? [];

  const priceMapping = {
    'SP95': 'sp95_prix',
    'SP98': 'sp98_prix',
    'E10': 'e10_prix',
    'Gazole': 'gazole_prix',
    'E85': 'e85_prix',
    'GPLc': 'gplc_prix',
  };

  return records.map<Station?>((r) {
    final prices = <String, double>{};
    for (final entry in priceMapping.entries) {
      final val = r[entry.value];
      if (val != null) prices[entry.key] = (val as num).toDouble();
    }

    final stationLat = (r['geom']?['lat'] as num?)?.toDouble();
    final stationLng = (r['geom']?['lon'] as num?)?.toDouble();
    if (stationLat == null || stationLng == null) return null;

    final brand =
        matchOSMBrand(osmBrands, stationLat, stationLng) ?? 'Station';

    final services = (r['services_service'] as List?)
            ?.map((s) => s.toString())
            .toList() ??
        [];
    final is24h = r['horaires_automate_24_24'] == 'Oui';

    final outOfStock = <String>[];
    final ruptDef = r['carburants_rupture_definitive'] as String?;
    final ruptTemp = r['carburants_rupture_temporaire'] as String?;
    if (ruptDef != null) {
      outOfStock.addAll(
          ruptDef.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty));
    }
    if (ruptTemp != null) {
      outOfStock.addAll(
          ruptTemp.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty));
    }

    final updateKey = '${fuelType.toLowerCase()}_maj';
    final updatedAt =
        (r[updateKey] ?? r['gazole_maj'])?.toString();

    return Station(
      id: 'FR-${r['id']}',
      brand: brand,
      address: r['adresse']?.toString() ?? '',
      city: r['ville']?.toString() ?? '',
      lat: stationLat,
      lng: stationLng,
      prices: prices,
      updatedAt: updatedAt,
      distance: haversineDistance(lat, lng, stationLat, stationLng),
      services: services,
      is24h: is24h,
      outOfStock: outOfStock,
    );
  }).whereType<Station>().toList();
}
