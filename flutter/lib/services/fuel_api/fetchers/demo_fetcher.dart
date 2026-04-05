import 'dart:math';
import '../../../models/station.dart';
import '../../../utils/geo.dart';

const _brands = <String, List<String>>{
  'FR': ['TotalEnergies', 'Leclerc', 'Carrefour', 'Intermarché', 'Auchan', 'BP', 'Shell', 'Esso'],
  'DE': ['Aral', 'Shell', 'Esso', 'Total', 'JET', 'AVIA', 'Agip', 'Star'],
  'UK': ['BP', 'Shell', 'Esso', 'Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Texaco'],
  'ES': ['Repsol', 'Cepsa', 'BP', 'Shell', 'Galp', 'Petronor', 'Ballenoil'],
  'IT': ['Eni', 'IP', 'Q8', 'TotalErg', 'Tamoil', 'Esso', 'API', 'Shell'],
  'AT': ['OMV', 'BP', 'Shell', 'Eni', 'JET', 'Avanti', 'Turmöl', 'IQ'],
  'KR': ['SK Energy', 'GS Caltex', 'S-Oil', 'Hyundai Oilbank', 'NH', 'E1'],
  'CL': ['COPEC', 'Shell', 'Petrobras', 'Terpel', 'ENEX'],
  'AU': ['Caltex', 'BP', 'Shell', '7-Eleven', 'United', 'Coles Express', 'Woolworths'],
  'MX': ['Pemex', 'BP', 'Shell', 'Mobil', 'Total', 'Oxxo Gas', 'G500'],
  'BR': ['Petrobras', 'Ipiranga', 'Shell', 'Ale', 'Repsol'],
  'AR': ['YPF', 'Shell', 'Axion Energy', 'Puma', 'Gulf', 'Petrobras'],
  'CH': ['Migrol', 'AVIA', 'Coop Pronto', 'Shell', 'BP', 'Eni', 'Agrola', 'Ruedi Rüssel'],
  'US': ['Shell', 'Chevron', 'ExxonMobil', 'BP', 'Marathon', 'Speedway', 'Circle K', 'Costco', 'Valero', '76'],
  'CA': ['Petro-Canada', 'Shell', 'Esso', 'Canadian Tire Gas+', 'Costco', 'Ultramar', 'Co-op', 'Husky', 'Pioneer'],
  'IE': ['Circle K', 'Applegreen', 'Maxol', 'Texaco', 'Emo', 'Amber', 'Shell', 'Go'],
  'HR': ['INA', 'Petrol', 'MOL', 'OMV', 'Tifon', 'Crodux', 'Lukoil'],
  'LU': ['Aral', 'Shell', 'TotalEnergies', 'Q8', 'Esso', 'Lukoil', 'Gulf'],
  'PT': ['Galp', 'Repsol', 'BP', 'Cepsa', 'Prio', 'Intermarche', 'Jumbo'],
  'SI': ['Petrol', 'MOL', 'OMV', 'Hofer (AVIA)', 'Euroil'],
  'DK': ['Q8', 'F24', 'Shell', 'Circle K', 'OK', 'Uno-X', 'Ingo'],
  'NZ': ['Z Energy', 'BP', 'Mobil', 'Caltex', 'Gull', 'Challenge', 'Waitomo', 'NPD'],
  'NL': ['Shell', 'BP', 'Esso', 'TotalEnergies', 'Tango', 'Tinq', 'Argos', 'Gulf'],
  'BE': ['TotalEnergies', 'Shell', 'Esso', 'Texaco', 'Q8', 'Lukoil', 'Gulf', 'Gabriels'],
  'GR': ['EKO', 'BP', 'Shell', 'Aegean', 'Avin', 'Revoil', 'Cyclon', 'Jet Oil'],
  'MY': ['Petronas', 'Shell', 'Petron', 'BHPetrol', 'Caltex'],
  'AE': ['ADNOC', 'ENOC', 'EPPCO', 'Emarat', 'Shell'],
  'ZA': ['Engen', 'Shell', 'BP', 'Caltex', 'TotalEnergies', 'Sasol'],
  'IN': ['Indian Oil', 'BPCL', 'HPCL', 'Shell', 'Nayara Energy', 'Reliance'],
  'EE': ['Alexela', 'Circle K', 'Neste', 'Terminal', 'Olerex', 'Krooning'],
  'LV': ['Circle K', 'Neste', 'Viada', 'Virsi', 'Astarte', 'Gotika'],
  'LT': ['Circle K', 'Neste', 'Viada', 'Orlen', 'Amic', 'EMSI'],
  'PL': ['Orlen', 'BP', 'Shell', 'Circle K', 'Amic', 'Moya', 'Lotos', 'AVIA'],
  'TH': ['PTT', 'Bangchak', 'Shell', 'Esso', 'Caltex', 'PT', 'Susco'],
  'JP': ['ENEOS', 'apollostation', 'Cosmo', 'Shell', 'Kygnus', 'Solato'],
  'ID': ['Pertamina', 'Shell', 'BP', 'Vivo', 'TotalEnergies'],
  'FI': ['Neste', 'St1', 'Shell', 'Teboil', 'ABC', 'Neste K'],
  'RO': ['Petrom', 'OMV', 'Lukoil', 'MOL', 'Rompetrol', 'Socar', 'Gazprom'],
  'HU': ['MOL', 'OMV', 'Shell', 'Auchan', 'AVIA', 'Orlen', 'ALDI'],
  'CZ': ['MOL', 'OMV', 'Shell', 'Orlen', 'Eni', 'EuroOil', 'Benzina'],
  'NO': ['Circle K', 'Esso', 'Shell', 'Uno-X', 'YX', 'St1', 'Best', 'Automat 1'],
  'SE': ['Circle K', 'OKQ8', 'Preem', 'Shell', 'St1', 'Tanka', 'Ingo', 'Qstar'],
  'TR': ['Petrol Ofisi', 'Opet', 'Shell', 'BP', 'Aytemiz', 'TP', 'TotalEnergies', 'Lukoil', 'Alpet'],
};

const _fuelRanges = <String, Map<String, List<double>>>{
  'FR': {'SP95': [1.65, 1.95], 'SP98': [1.75, 2.05], 'E10': [1.60, 1.90], 'Gazole': [1.55, 1.85], 'E85': [0.75, 0.95], 'GPLc': [0.85, 1.05]},
  'DE': {'e5': [1.65, 1.95], 'e10': [1.60, 1.90], 'diesel': [1.55, 1.85]},
  'UK': {'unleaded': [135, 155], 'diesel': [140, 160], 'super_unleaded': [150, 170]},
  'ES': {'gasolina95': [1.45, 1.75], 'gasolina98': [1.55, 1.85], 'gasoleo': [1.40, 1.70], 'glp': [0.75, 0.95]},
  'IT': {'benzina': [1.70, 2.00], 'gasolio': [1.60, 1.90], 'gpl': [0.70, 0.90], 'metano': [1.30, 1.60]},
  'AT': {'SUP': [1.55, 1.85], 'GOE': [1.50, 1.80], 'GAS': [1.20, 1.50]},
  'KR': {'B027': [1600, 1900], 'B034': [1800, 2100], 'D047': [1500, 1800], 'K015': [900, 1100]},
  'CL': {'gasolina93': [1100, 1400], 'gasolina95': [1200, 1500], 'gasolina97': [1300, 1600], 'diesel': [1000, 1300], 'glp': [600, 800]},
  'AU': {'E10': [170, 210], 'U91': [175, 215], 'P95': [185, 225], 'P98': [195, 235], 'DL': [180, 220], 'LPG': [80, 110]},
  'MX': {'regular': [21, 25], 'premium': [23, 27], 'diesel': [22, 26]},
  'BR': {'gasolina': [5.5, 7.0], 'gasolina_ad': [5.8, 7.3], 'etanol': [3.5, 5.0], 'diesel': [5.0, 6.5], 'gnv': [3.5, 5.0]},
  'AR': {'nafta_super': [500, 800], 'nafta_premium': [600, 900], 'diesel': [500, 750], 'diesel_premium': [600, 850], 'gnc': [200, 400]},
  'CH': {'E95': [1.70, 1.95], 'E98': [1.80, 2.05], 'Diesel': [1.75, 2.00]},
  'US': {'regular': [3.10, 4.20], 'midgrade': [3.50, 4.60], 'premium': [3.90, 5.00], 'diesel': [3.60, 4.80]},
  'CA': {'regular': [1.50, 1.95], 'midgrade': [1.65, 2.10], 'premium': [1.80, 2.25], 'diesel': [1.60, 2.05]},
  'IE': {'unleaded': [165, 195], 'diesel': [155, 185]},
  'HR': {'eurosuper95': [1.40, 1.65], 'eurosuper100': [1.90, 2.20], 'eurodizel': [1.35, 1.60], 'lpg': [0.70, 0.95]},
  'LU': {'E10': [1.45, 1.70], 'SP98': [1.55, 1.80], 'diesel': [1.40, 1.65]},
  'PT': {'gasolina_95': [1.60, 1.90], 'gasoleo': [1.50, 1.80], 'gasoleo_especial': [1.55, 1.85], 'gpl': [0.75, 0.95]},
  'SI': {'95': [1.45, 1.70], 'dizel': [1.40, 1.65], '98': [1.50, 1.75], 'avtoplin-lpg': [0.80, 1.05]},
  'DK': {'e10': [15.0, 17.5], 'e5': [16.5, 18.5], 'diesel': [16.5, 19.5], 'diesel_extra': [17.5, 20.0]},
  'NZ': {'91': [2.80, 3.50], '95': [3.00, 3.70], '98': [3.20, 3.90], 'diesel': [2.70, 3.40]},
  'NL': {'euro95': [1.85, 2.15], 'diesel': [1.75, 2.05], 'lpg': [0.80, 1.10]},
  'BE': {'E10': [1.60, 1.90], 'SP98': [1.70, 2.00], 'diesel': [1.65, 1.95], 'LPG': [0.75, 1.00]},
  'GR': {'unleaded_95': [1.70, 2.00], 'unleaded_100': [1.85, 2.15], 'diesel': [1.55, 1.85], 'lpg': [0.80, 1.05]},
  'MY': {'RON95': [2.05, 2.05], 'RON97': [3.30, 3.60], 'diesel': [2.15, 2.15]},
  'AE': {'super98': [2.90, 3.10], 'special95': [2.80, 3.00], 'eplus91': [2.70, 2.90], 'diesel': [2.90, 3.10]},
  'ZA': {'ULP95': [21.0, 23.0], 'ULP93': [20.5, 22.5], 'diesel_50': [18.5, 20.0], 'diesel_500': [18.0, 19.5]},
  'IN': {'petrol': [95, 110], 'diesel': [85, 95], 'cng': [75, 85]},
  'EE': {'e95': [1.70, 1.90], 'e98': [1.80, 2.00], 'diesel': [1.65, 1.85], 'lpg': [0.70, 0.95]},
  'LV': {'e95': [1.70, 1.90], 'e98': [1.80, 2.00], 'diesel': [1.65, 1.85], 'lpg': [0.70, 0.95]},
  'LT': {'e95': [1.70, 1.90], 'e98': [1.80, 2.00], 'diesel': [1.65, 1.85], 'lpg': [0.70, 0.95]},
  'PL': {'pb95': [6.00, 7.50], 'pb98': [7.00, 8.50], 'diesel': [6.00, 7.50], 'lpg': [2.50, 3.80], 'on_plus': [7.00, 8.50]},
  'TH': {'gasohol95': [35, 42], 'gasohol91': [33, 40], 'e20': [30, 37], 'diesel_premium': [35, 40], 'diesel': [30, 35]},
  'JP': {'regular': [155, 180], 'premium': [165, 195], 'diesel': [135, 160]},
  'ID': {'pertalite': [10000, 10000], 'pertamax': [12300, 12300], 'pertamax_turbo': [14250, 14250], 'solar': [6800, 6800], 'dexlite': [13800, 13800]},
  'FI': {'e95': [1.75, 1.95], 'e98': [1.85, 2.05], 'diesel': [1.70, 1.90], 'lpg': [0.70, 0.95]},
  'RO': {'benzina95': [7.5, 9.5], 'benzina_premium': [8.0, 10.0], 'diesel': [8.0, 10.5], 'diesel_premium': [8.5, 11.0], 'gpl': [3.5, 4.5]},
  'HU': {'e5': [580, 650], 'diesel': [600, 670], 'lpg': [350, 420]},
  'CZ': {'natural95': [36, 42], 'diesel': [36, 42], 'lpg': [16, 22]},
  'NO': {'gasoline_95': [18, 22], 'diesel': [20, 25]},
  'SE': {'95': [18, 22], '98': [20, 24], 'diesel': [22, 27], 'etanol': [15, 19]},
  'TR': {'benzin95': [42, 46], 'motorin': [43, 47], 'lpg': [16, 19]},
};

List<Station> generateDemoStations(
    double lat, double lng, double radiusKm, String country) {
  final rng = Random();
  final count = 15 + rng.nextInt(10);
  final brands = _brands[country] ?? _brands['FR']!;
  final fuelRanges = _fuelRanges[country] ?? _fuelRanges['FR']!;

  final stations = List.generate(count, (i) {
    final angle = rng.nextDouble() * 2 * pi;
    final dist = rng.nextDouble() * radiusKm;
    final dLat = (dist / 111) * cos(angle);
    final dLng = (dist / (111 * cos(lat * pi / 180))) * sin(angle);
    final sLat = lat + dLat;
    final sLng = lng + dLng;

    final prices = <String, double>{};
    for (final entry in fuelRanges.entries) {
      if (rng.nextDouble() > 0.15) {
        final min = entry.value[0];
        final max = entry.value[1];
        prices[entry.key] =
            double.parse((min + rng.nextDouble() * (max - min)).toStringAsFixed(3));
      }
    }

    final hoursAgo = rng.nextInt(48);
    final updated =
        DateTime.now().subtract(Duration(hours: hoursAgo)).toIso8601String();

    return Station(
      id: '$country-DEMO-$i',
      brand: brands[rng.nextInt(brands.length)],
      address: '${rng.nextInt(200) + 1} Rue Example',
      city: 'Demo City',
      lat: sLat,
      lng: sLng,
      prices: prices,
      updatedAt: updated,
      distance: haversineDistance(lat, lng, sLat, sLng),
    );
  });

  stations.sort((a, b) => (a.distance ?? 0).compareTo(b.distance ?? 0));
  return stations;
}
