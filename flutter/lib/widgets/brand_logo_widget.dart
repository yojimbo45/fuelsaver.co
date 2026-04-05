import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../utils/brand_logo.dart';

class BrandLogoWidget extends StatelessWidget {
  final String? brand;
  final double size;

  const BrandLogoWidget({super.key, this.brand, this.size = 36});

  @override
  Widget build(BuildContext context) {
    final url = getBrandLogoUrl(brand);
    if (url != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size / 2),
        child: CachedNetworkImage(
          imageUrl: url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => _fallback(),
          placeholder: (_, _) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    final letter =
        (brand != null && brand!.isNotEmpty) ? brand![0].toUpperCase() : '?';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.grey.shade300,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(letter,
          style: TextStyle(
              fontWeight: FontWeight.bold, fontSize: size * 0.45)),
    );
  }
}
