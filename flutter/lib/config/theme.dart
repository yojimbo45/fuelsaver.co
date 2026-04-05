import 'package:flutter/material.dart';

class AppTheme {
  static const primaryOrange = Color(0xFFF97316);
  static const greenCheap = Color(0xFF22C55E);
  static const redExpensive = Color(0xFFEF4444);

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorSchemeSeed: primaryOrange,
        brightness: Brightness.light,
        appBarTheme: const AppBarTheme(
          backgroundColor: primaryOrange,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: primaryOrange,
          foregroundColor: Colors.white,
        ),
      );
}
