import '../../models/station.dart';
import 'fetchers/worker_fetcher.dart';
import 'fetchers/demo_fetcher.dart';

/// All countries supported by the unified worker API.
const _supportedCountries = {
  'FR', 'ES', 'IT', 'UK', 'IE', 'CH', 'CL', 'MX', 'AR', 'BR',
  'DE', 'HR', 'LU', 'PT', 'SI', 'AT', 'KR', 'AU',
  'DK', 'NZ', 'NL', 'BE', 'GR', 'MY', 'AE', 'ZA', 'IN',
  'EE', 'LV', 'LT', 'PL',
  'TH', 'JP', 'ID', 'FI',
  'RO', 'HU', 'CZ',
  'NO', 'SE', 'TR',
  'US', 'CA',
};

Future<List<Station>> fetchStations(
    String countryCode, double lat, double lng, double radiusKm,
    String fuelType) async {
  if (!_supportedCountries.contains(countryCode)) {
    throw Exception('Unsupported country: $countryCode');
  }

  try {
    return await fetchFromWorker(countryCode, lat, lng, radiusKm, fuelType);
  } catch (e) {
    // Fall back to demo data if the worker call fails
    return generateDemoStations(lat, lng, radiusKm, countryCode);
  }
}
