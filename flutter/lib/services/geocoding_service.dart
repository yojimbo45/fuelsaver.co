import 'package:dio/dio.dart';
import '../config/env.dart';
import '../models/autocomplete_result.dart';

const _mapboxUrl = 'https://api.mapbox.com/search/geocode/v6';

const _isoToCountry = <String, String>{
  'FR': 'FR', 'DE': 'DE', 'GB': 'UK', 'ES': 'ES', 'IT': 'IT',
  'AT': 'AT', 'KR': 'KR', 'CL': 'CL', 'AU': 'AU', 'MX': 'MX',
  'BR': 'BR', 'AR': 'AR', 'CH': 'CH',
};

final _dio = Dio();

String? _extractCountryCode(Map<String, dynamic> feature) {
  final iso = (feature['properties']?['context']?['country']
          ?['country_code'] as String?)
      ?.toUpperCase();
  return _isoToCountry[iso];
}

Future<List<AutocompleteResult>> autocompletePlaces(String query) async {
  if (query.length < 2) return [];

  final token = Env.mapboxToken;
  if (token.isEmpty) return _fallbackNominatim(query);

  try {
    final res = await _dio.get('$_mapboxUrl/forward', queryParameters: {
      'q': query,
      'access_token': token,
      'language': 'en',
      'limit': '5',
      'types': 'place,locality,postcode,address,neighborhood',
    });
    final features = (res.data['features'] as List?) ?? [];
    return features.map<AutocompleteResult>((f) {
      final coords = f['geometry']['coordinates'] as List;
      return AutocompleteResult(
        id: f['id']?.toString() ?? '',
        text: f['properties']['full_address'] ??
            f['properties']['name'] ??
            '',
        lat: (coords[1] as num).toDouble(),
        lng: (coords[0] as num).toDouble(),
        countryCode: _extractCountryCode(f),
      );
    }).toList();
  } catch (_) {
    return [];
  }
}

Future<AutocompleteResult> geocodeAddress(String query) async {
  final token = Env.mapboxToken;
  if (token.isEmpty) {
    final results = await _fallbackNominatim(query);
    if (results.isEmpty) throw Exception('Location not found');
    return results.first;
  }

  final res = await _dio.get('$_mapboxUrl/forward', queryParameters: {
    'q': query,
    'access_token': token,
    'language': 'en',
    'limit': '1',
  });

  final features = (res.data['features'] as List?) ?? [];
  if (features.isEmpty) throw Exception('Location not found');

  final f = features.first;
  final coords = f['geometry']['coordinates'] as List;
  return AutocompleteResult(
    id: f['id']?.toString() ?? '',
    text: f['properties']['full_address'] ?? f['properties']['name'] ?? '',
    lat: (coords[1] as num).toDouble(),
    lng: (coords[0] as num).toDouble(),
    countryCode: _extractCountryCode(f),
  );
}

Future<List<AutocompleteResult>> _fallbackNominatim(String query) async {
  try {
    final res = await _dio.get(
      'https://nominatim.openstreetmap.org/search',
      queryParameters: {
        'q': query,
        'format': 'json',
        'limit': '5',
        'addressdetails': '1',
      },
      options: Options(headers: {'Accept-Language': 'en'}),
    );
    return (res.data as List).map<AutocompleteResult>((d) {
      final iso =
          (d['address']?['country_code'] as String?)?.toUpperCase() ?? '';
      return AutocompleteResult(
        id: d['place_id']?.toString() ?? '',
        text: d['display_name'] ?? '',
        lat: double.tryParse(d['lat']?.toString() ?? '') ?? 0,
        lng: double.tryParse(d['lon']?.toString() ?? '') ?? 0,
        countryCode: _isoToCountry[iso],
      );
    }).toList();
  } catch (_) {
    return [];
  }
}
