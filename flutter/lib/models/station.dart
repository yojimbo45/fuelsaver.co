class Station {
  final String id;
  final String brand;
  final String address;
  final String city;
  final double lat;
  final double lng;
  final Map<String, double> prices;
  final String? updatedAt;
  final double? distance;
  final List<String> services;
  final bool is24h;
  final List<String> outOfStock;

  const Station({
    required this.id,
    required this.brand,
    required this.address,
    required this.city,
    required this.lat,
    required this.lng,
    required this.prices,
    this.updatedAt,
    this.distance,
    this.services = const [],
    this.is24h = false,
    this.outOfStock = const [],
  });

  factory Station.fromJson(Map<String, dynamic> json) {
    // Normalize prices: some handlers return {price: num}, others return raw num
    final rawPrices = json['prices'] as Map<String, dynamic>? ?? {};
    final prices = <String, double>{};
    for (final entry in rawPrices.entries) {
      final val = entry.value;
      if (val is num) {
        prices[entry.key] = val.toDouble();
      } else if (val is Map && val['price'] is num) {
        prices[entry.key] = (val['price'] as num).toDouble();
      }
    }

    return Station(
      id: json['id'] as String? ?? '',
      brand: json['brand'] as String? ?? '',
      address: json['address'] as String? ?? '',
      city: json['city'] as String? ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      prices: prices,
      updatedAt: json['updatedAt'] as String?,
      distance: (json['distance'] as num?)?.toDouble(),
      services: (json['services'] as List?)?.cast<String>() ?? const [],
      is24h: json['is24h'] as bool? ?? false,
      outOfStock: (json['outOfStock'] as List?)?.cast<String>() ?? const [],
    );
  }
}
