import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:in_app_review/in_app_review.dart';
import '../config/env.dart';

class ReviewService {
  static const _openCountKey = 'app_open_count';
  static const _promptShownKey = 'review_prompt_shown';

  static Future<void> incrementAppOpenCount() async {
    final prefs = await SharedPreferences.getInstance();
    final count = prefs.getInt(_openCountKey) ?? 0;
    await prefs.setInt(_openCountKey, count + 1);
  }

  static Future<bool> shouldShowReviewPrompt() async {
    final prefs = await SharedPreferences.getInstance();
    final count = prefs.getInt(_openCountKey) ?? 0;
    final shown = prefs.getBool(_promptShownKey) ?? false;
    return count >= 2 && !shown;
  }

  static Future<void> markReviewPromptShown() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_promptShownKey, true);
  }

  static Future<void> requestNativeReview() async {
    final inAppReview = InAppReview.instance;
    if (await inAppReview.isAvailable()) {
      await inAppReview.requestReview();
    }
  }

  static Future<void> sendFeedback(String text) async {
    final baseUrl = Env.workerUrl;
    if (baseUrl.isEmpty || text.trim().isEmpty) return;

    try {
      await Dio().post(
        '$baseUrl/api/feedback',
        data: {
          'text': text.trim(),
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
      );
    } catch (_) {
      // Silently fail — don't interrupt the user
    }
  }
}
