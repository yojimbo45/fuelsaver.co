import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/countries.dart';
import '../config/theme.dart';
import '../models/autocomplete_result.dart';
import '../providers/country_provider.dart';
import '../providers/search_provider.dart';
import '../services/geocoding_service.dart' as geo;

class SearchBarWidget extends ConsumerStatefulWidget {
  const SearchBarWidget({super.key});

  @override
  ConsumerState<SearchBarWidget> createState() => _SearchBarWidgetState();
}

class _SearchBarWidgetState extends ConsumerState<SearchBarWidget> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  List<AutocompleteResult> _suggestions = [];
  Timer? _debounce;
  bool _showSuggestions = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      if (query.length < 2) {
        setState(() {
          _suggestions = [];
          _showSuggestions = false;
        });
        return;
      }
      final results = await geo.autocompletePlaces(query);
      if (mounted) {
        setState(() {
          _suggestions = results;
          _showSuggestions = results.isNotEmpty;
        });
      }
    });
  }

  void _onSelect(AutocompleteResult result) {
    _controller.text = result.text;
    setState(() => _showSuggestions = false);
    _focusNode.unfocus();

    // Auto-detect country
    if (result.countryCode != null &&
        countries.containsKey(result.countryCode)) {
      ref.read(countryCodeProvider.notifier).state = result.countryCode!;
      // Reset fuel type to default for new country
      final config = countries[result.countryCode!]!;
      ref.read(fuelTypeProvider.notifier).state = config.defaultFuel;
    }

    ref.read(searchProvider.notifier).search(
          result.lat,
          result.lng,
          displayName: result.text,
        );
  }

  void _onSubmit(String query) async {
    if (query.length < 2) return;
    setState(() => _showSuggestions = false);
    _focusNode.unfocus();

    try {
      final result = await geo.geocodeAddress(query);
      if (result.countryCode != null &&
          countries.containsKey(result.countryCode)) {
        ref.read(countryCodeProvider.notifier).state = result.countryCode!;
        final config = countries[result.countryCode!]!;
        ref.read(fuelTypeProvider.notifier).state = config.defaultFuel;
      }
      ref.read(searchProvider.notifier).search(
            result.lat,
            result.lng,
            displayName: result.text,
          );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Location not found')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final countryCode = ref.watch(countryCodeProvider);
    final config = countries[countryCode]!;
    final fuelType = ref.watch(fuelTypeProvider);
    final radius = ref.watch(radiusKmProvider);
    final isLoading = ref.watch(searchProvider).loading;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Search field
        Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _controller,
                focusNode: _focusNode,
                onChanged: _onChanged,
                onSubmitted: _onSubmit,
                decoration: InputDecoration(
                  hintText: 'Search location...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: isLoading
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2)))
                      : _controller.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _controller.clear();
                                ref.read(searchProvider.notifier).clear();
                                setState(() => _showSuggestions = false);
                              },
                            )
                          : null,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                ),
              ),
              // Filters row
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                child: Row(
                  children: [
                    // Country selector
                    PopupMenuButton<String>(
                      onSelected: (code) {
                        ref.read(countryCodeProvider.notifier).state = code;
                        final c = countries[code]!;
                        ref.read(fuelTypeProvider.notifier).state =
                            c.defaultFuel;
                      },
                      itemBuilder: (_) => countries.entries
                          .map((e) => PopupMenuItem(
                                value: e.key,
                                child: Text('${e.value.flag} ${e.value.name}'),
                              ))
                          .toList(),
                      child: Chip(
                        label: Text('${config.flag} ${config.code}'),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                    const SizedBox(width: 4),
                    // Fuel type selector
                    Expanded(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: config.fuelTypes.map((ft) {
                            final selected = ft.id == fuelType;
                            return Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: ChoiceChip(
                                label: Text(ft.label,
                                    style: const TextStyle(fontSize: 11)),
                                selected: selected,
                                selectedColor: AppTheme.primaryOrange
                                    .withValues(alpha: 0.2),
                                onSelected: (_) {
                                  ref.read(fuelTypeProvider.notifier).state =
                                      ft.id;
                                  // Re-search if we have a search center
                                  final sc = ref
                                      .read(searchProvider)
                                      .searchCenter;
                                  if (sc != null) {
                                    ref
                                        .read(searchProvider.notifier)
                                        .search(sc.lat, sc.lng);
                                  }
                                },
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                    // Radius selector
                    PopupMenuButton<double>(
                      onSelected: (r) {
                        ref.read(radiusKmProvider.notifier).state = r;
                        final sc =
                            ref.read(searchProvider).searchCenter;
                        if (sc != null) {
                          ref
                              .read(searchProvider.notifier)
                              .search(sc.lat, sc.lng, radiusKm: r);
                        }
                      },
                      itemBuilder: (_) => [5.0, 10.0, 15.0, 25.0, 50.0]
                          .map((r) => PopupMenuItem(
                                value: r,
                                child: Text('${r.toInt()} km'),
                              ))
                          .toList(),
                      child: Chip(
                        label: Text('${radius.toInt()} km',
                            style: const TextStyle(fontSize: 11)),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Autocomplete suggestions
        if (_showSuggestions)
          Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ListView.builder(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _suggestions.length,
              itemBuilder: (_, i) {
                final s = _suggestions[i];
                return ListTile(
                  dense: true,
                  leading: const Icon(Icons.place, size: 20),
                  title: Text(s.text,
                      style: const TextStyle(fontSize: 13),
                      overflow: TextOverflow.ellipsis),
                  onTap: () => _onSelect(s),
                );
              },
            ),
          ),
      ],
    );
  }
}
