class FuelType {
  final String id;
  final String label;
  const FuelType({required this.id, required this.label});
}

class CountryConfig {
  final String code;
  final String name;
  final String flag;
  final double centerLng;
  final double centerLat;
  final double zoom;
  final String currency;
  final String unit;
  final List<FuelType> fuelTypes;
  final String defaultFuel;
  final String source;
  final String sourceUrl;

  const CountryConfig({
    required this.code,
    required this.name,
    required this.flag,
    required this.centerLng,
    required this.centerLat,
    required this.zoom,
    required this.currency,
    required this.unit,
    required this.fuelTypes,
    required this.defaultFuel,
    required this.source,
    required this.sourceUrl,
  });
}
