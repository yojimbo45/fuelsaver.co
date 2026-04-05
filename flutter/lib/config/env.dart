import 'package:flutter_dotenv/flutter_dotenv.dart';

class Env {
  static String get workerUrl => dotenv.env['WORKER_URL'] ?? '';
  static String get mapboxToken => dotenv.env['MAPBOX_TOKEN'] ?? '';
  static String get fuelcheckNswKey => dotenv.env['FUELCHECK_NSW_KEY'] ?? '';
  static String get fuelcheckNswSecret =>
      dotenv.env['FUELCHECK_NSW_SECRET'] ?? '';
  static String get brazilWorkerUrl => dotenv.env['BRAZIL_WORKER_URL'] ?? '';
  static String get tankerkoenigKey => dotenv.env['TANKERKOENIG_KEY'] ?? '';
  static String get opinetKey => dotenv.env['OPINET_KEY'] ?? '';
  static String get switzerlandProxyUrl =>
      dotenv.env['SWITZERLAND_PROXY_URL'] ?? '';
  static String get usaWorkerUrl => dotenv.env['USA_WORKER_URL'] ?? '';
  static String get canadaWorkerUrl => dotenv.env['CANADA_WORKER_URL'] ?? '';
}
