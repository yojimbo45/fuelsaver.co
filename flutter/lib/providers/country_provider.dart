import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/countries.dart';
import '../models/country_config.dart';

final countryCodeProvider = StateProvider<String>((ref) => defaultCountry);

final countryConfigProvider = Provider<CountryConfig>((ref) {
  final code = ref.watch(countryCodeProvider);
  return countries[code] ?? countries[defaultCountry]!;
});

final fuelTypeProvider = StateProvider<String>((ref) {
  final config = ref.watch(countryConfigProvider);
  return config.defaultFuel;
});

final radiusKmProvider = StateProvider<double>((ref) => 10.0);
