String formatPrice(double? price, String currency) {
  if (price == null) return '\u2014';
  if (currency == 'p') return '${price.toStringAsFixed(1)}p';
  if (currency == 'c') return '${price.toStringAsFixed(1)}c';
  return '$currency\u00A0${price.toStringAsFixed(3)}';
}

String formatPriceShort(double? price, String currency) {
  if (price == null) return '\u2014';
  if (currency == 'p') return '${price.toStringAsFixed(0)}p';
  if (currency == 'c') return '${price.toStringAsFixed(0)}c';
  return '$currency\u00A0${price.toStringAsFixed(2)}';
}

String formatUpdated(String? dateStr) {
  if (dateStr == null || dateStr.isEmpty) return '';
  final date = DateTime.tryParse(dateStr);
  if (date == null) return dateStr;

  final now = DateTime.now();
  final diff = now.difference(date);
  final diffDays = diff.inDays;

  if (diffDays < 1) return 'verified today';
  if (diffDays == 1) return 'verified yesterday';
  if (diffDays < 7) return 'verified ${diffDays}d ago';

  final months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return 'verified ${date.day} ${months[date.month - 1]}';
}
