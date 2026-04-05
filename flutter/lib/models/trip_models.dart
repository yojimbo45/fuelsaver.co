class TripPlace {
  final String text;
  final double lat;
  final double lng;
  final String? countryCode;

  const TripPlace({
    required this.text,
    required this.lat,
    required this.lng,
    this.countryCode,
  });
}

class TripRoute {
  final Map<String, dynamic> geometry; // GeoJSON LineString
  final double distance; // km
  final double duration; // seconds

  const TripRoute({
    required this.geometry,
    required this.distance,
    required this.duration,
  });

  List<List<double>> get coordinates {
    final coords = geometry['coordinates'] as List;
    return coords.map<List<double>>((c) {
      final pair = c as List;
      return [
        (pair[0] as num).toDouble(),
        (pair[1] as num).toDouble(),
      ];
    }).toList();
  }
}

class TripCost {
  final double fuelNeeded; // liters
  final double cost; // currency units
  final double pricePerUnit;
  final double distance; // km
  final double duration; // seconds
  final int stationCount;

  const TripCost({
    required this.fuelNeeded,
    required this.cost,
    required this.pricePerUnit,
    required this.distance,
    required this.duration,
    required this.stationCount,
  });

  TripCost copyWith({
    double? fuelNeeded,
    double? cost,
    double? pricePerUnit,
    double? distance,
    double? duration,
    int? stationCount,
  }) =>
      TripCost(
        fuelNeeded: fuelNeeded ?? this.fuelNeeded,
        cost: cost ?? this.cost,
        pricePerUnit: pricePerUnit ?? this.pricePerUnit,
        distance: distance ?? this.distance,
        duration: duration ?? this.duration,
        stationCount: stationCount ?? this.stationCount,
      );
}

class TripStation {
  final String id;
  final String brand;
  final String address;
  final String city;
  final double lat;
  final double lng;
  final Map<String, double> prices;
  final String? updatedAt;
  final double price; // price for selected fuel type
  final double routeDistance; // km from route polyline
  final String countryCode;

  const TripStation({
    required this.id,
    required this.brand,
    required this.address,
    required this.city,
    required this.lat,
    required this.lng,
    required this.prices,
    this.updatedAt,
    required this.price,
    required this.routeDistance,
    required this.countryCode,
  });
}

class Vehicle {
  final String make;
  final String model;
  final String years;
  final double consumption; // L/100km
  final double tank; // liters

  const Vehicle({
    required this.make,
    required this.model,
    required this.years,
    required this.consumption,
    required this.tank,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      make: json['make'] as String? ?? '',
      model: json['model'] as String? ?? '',
      years: json['years'] as String? ?? '',
      consumption: (json['consumption'] as num?)?.toDouble() ?? 0,
      tank: (json['tank'] as num?)?.toDouble() ?? 0,
    );
  }
}
