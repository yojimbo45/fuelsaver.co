import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../config/theme.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..forward();

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (_, a, b) => const HomeScreen(),
            transitionsBuilder: (_, animation, a, child) =>
                FadeTransition(opacity: animation, child: child),
            transitionDuration: const Duration(milliseconds: 400),
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          const Spacer(flex: 3),
          // Logo
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: SvgPicture.asset(
                'assets/logo.svg',
                width: 120,
                height: 120,
              ),
            ),
          ),
          const SizedBox(height: 24),
          // App name
          const Text(
            'FuelSaver',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AppTheme.primaryOrange,
              letterSpacing: 1.2,
            ),
          ),
          const Spacer(flex: 3),
          // Loading bar at bottom
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 64),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _controller.value,
                    minHeight: 4,
                    backgroundColor: AppTheme.primaryOrange.withValues(alpha: 0.15),
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      AppTheme.primaryOrange,
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 48),
        ],
      ),
    );
  }
}
