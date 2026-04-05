import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../models/trip_models.dart';
import 'trip_map_maplibre.dart' as maplibre;
import 'trip_map_apple.dart' as apple;

class TripMapWidget extends StatelessWidget {
  final TripRoute? route;
  final List<TripStation> stations;
  final TripPlace? origin;
  final TripPlace? destination;
  final String fuelType;
  final ValueChanged<TripStation>? onStationTap;

  const TripMapWidget({
    super.key,
    this.route,
    required this.stations,
    this.origin,
    this.destination,
    required this.fuelType,
    this.onStationTap,
  });

  @override
  Widget build(BuildContext context) {
    if (!kIsWeb && Platform.isIOS) {
      return apple.TripMapApple(
        route: route,
        stations: stations,
        origin: origin,
        destination: destination,
        fuelType: fuelType,
        onStationTap: onStationTap,
      );
    }

    return maplibre.TripMapMaplibre(
      route: route,
      stations: stations,
      origin: origin,
      destination: destination,
      fuelType: fuelType,
      onStationTap: onStationTap,
    );
  }
}
