class SearchParams {
  final double lat;
  final double lng;
  final double radiusKm;
  final String? displayName;

  const SearchParams({
    required this.lat,
    required this.lng,
    this.radiusKm = 10,
    this.displayName,
  });
}
