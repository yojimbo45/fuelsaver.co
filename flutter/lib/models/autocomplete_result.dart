class AutocompleteResult {
  final String id;
  final String text;
  final double lat;
  final double lng;
  final String? countryCode;

  const AutocompleteResult({
    required this.id,
    required this.text,
    required this.lat,
    required this.lng,
    this.countryCode,
  });
}
