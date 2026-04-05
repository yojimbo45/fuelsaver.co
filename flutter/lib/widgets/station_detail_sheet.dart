import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/station.dart';
import '../models/country_config.dart';
import '../utils/format.dart';
import '../utils/geo.dart';
import 'brand_logo_widget.dart';

const _serviceIcons = <String, (String, String)>{
  'Toilettes publiques': ('\u{1F6BD}', 'WC'),
  'Boutique alimentaire': ('\u{1F3EA}', 'Shop'),
  'Boutique non alimentaire': ('\u{1F6CD}\u{FE0F}', 'Shop'),
  'DAB (Distributeur automatique de billets)': ('\u{1F4B3}', 'ATM'),
  'Station de gonflage': ('\u{1F4A8}', 'Air'),
  'Lavage automatique': ('\u{1FAE7}', 'Wash'),
  'Lavage manuel': ('\u{1FAE7}', 'Wash'),
  'Services r\u00E9paration / entretien': ('\u{1F527}', 'Repair'),
  'Carburant additiv\u00E9': ('\u{26FD}', 'Additive'),
  'Piste poids lourds': ('\u{1F69B}', 'Truck'),
  'Relais colis': ('\u{1F4E6}', 'Parcel'),
  'Vente de p\u00E9trole lampant': ('\u{1FA94}', 'Lamp oil'),
  'Aire de camping-cars': ('\u{1F690}', 'Camper'),
  'Vente de gaz domestique (Butane, Propane)': ('\u{1F525}', 'Gas'),
  'Bornes \u00E9lectriques': ('\u{26A1}', 'EV'),
  'Automate CB 24/24': ('\u{1F3E7}', 'Card 24/7'),
  'Wifi': ('\u{1F4F6}', 'WiFi'),
  'Location de v\u00E9hicule': ('\u{1F697}', 'Rental'),
};

void showStationDetail(BuildContext context, Station station,
    CountryConfig countryConfig, String fuelType) {
  final fuelLabels = <String, String>{
    for (final ft in countryConfig.fuelTypes) ft.id: ft.label,
  };
  final currency = countryConfig.currency;

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(20),
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Row(
            children: [
              BrandLogoWidget(brand: station.brand, size: 44),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(station.brand,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                    Text(
                      station.address +
                          (station.city.isNotEmpty
                              ? ', ${station.city}'
                              : ''),
                      style: TextStyle(
                          fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (station.is24h) ...[
            const SizedBox(height: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.access_time, size: 14, color: Colors.blue),
                  SizedBox(width: 4),
                  Text('Open 24/7',
                      style: TextStyle(fontSize: 12, color: Colors.blue)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          // Prices table
          ...station.prices.entries.map((entry) {
            final label = fuelLabels[entry.key] ?? entry.key;
            final isSelected = entry.key == fuelType;
            final isOut = station.outOfStock.any((s) =>
                s.toLowerCase() == entry.key.toLowerCase() ||
                s.toLowerCase() == label.toLowerCase());

            return Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppTheme.primaryOrange.withValues(alpha: 0.08)
                    : null,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                        decoration:
                            isOut ? TextDecoration.lineThrough : null,
                      ),
                    ),
                  ),
                  Text(
                    isOut ? 'out of stock' : formatPrice(entry.value, currency),
                    style: TextStyle(
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isOut ? Colors.red.shade400 : null,
                    ),
                  ),
                ],
              ),
            );
          }),
          // Services
          if (station.services.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: _buildServiceChips(station.services),
            ),
          ],
          // Meta
          const SizedBox(height: 16),
          Row(
            children: [
              if (station.updatedAt != null &&
                  station.updatedAt!.isNotEmpty)
                Text(formatUpdated(station.updatedAt),
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade500)),
              if (station.distance != null) ...[
                if (station.updatedAt != null &&
                    station.updatedAt!.isNotEmpty)
                  Text(' \u00B7 ',
                      style: TextStyle(
                          fontSize: 12, color: Colors.grey.shade500)),
                Text(formatDistance(station.distance!),
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade500)),
              ],
            ],
          ),
        ],
      ),
    ),
  );
}

List<Widget> _buildServiceChips(List<String> services) {
  final seen = <String>{};
  final chips = <Widget>[];
  for (final s in services) {
    var match = _serviceIcons[s];
    if (match == null) {
      for (final entry in _serviceIcons.entries) {
        if (s.toLowerCase().contains(entry.key.toLowerCase()) ||
            entry.key.toLowerCase().contains(s.toLowerCase())) {
          match = entry.value;
          break;
        }
      }
    }
    if (match == null || seen.contains(match.$2)) continue;
    seen.add(match.$2);
    chips.add(Chip(
      label: Text('${match.$1} ${match.$2}', style: const TextStyle(fontSize: 12)),
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
    ));
  }
  return chips;
}
