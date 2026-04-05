import 'dart:async';
import 'package:flutter/material.dart';
import '../../config/countries.dart';
import '../../models/autocomplete_result.dart';
import '../../models/trip_models.dart';
import '../../services/geocoding_service.dart' as geocoding;

class TripPlaceInput extends StatefulWidget {
  final TripPlace? value;
  final String placeholder;
  final Color dotColor;
  final ValueChanged<TripPlace> onSelect;
  final VoidCallback? onClear;

  const TripPlaceInput({
    super.key,
    this.value,
    required this.placeholder,
    required this.dotColor,
    required this.onSelect,
    this.onClear,
  });

  @override
  State<TripPlaceInput> createState() => _TripPlaceInputState();
}

class _TripPlaceInputState extends State<TripPlaceInput> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  List<AutocompleteResult> _suggestions = [];
  bool _showSuggestions = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller.text = widget.value?.text ?? '';
  }

  @override
  void didUpdateWidget(TripPlaceInput old) {
    super.didUpdateWidget(old);
    if (widget.value?.text != old.value?.text) {
      _controller.text = widget.value?.text ?? '';
    }
  }

  void _onChanged(String val) {
    if (val.isEmpty) {
      widget.onClear?.call();
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
      return;
    }

    _debounce?.cancel();
    if (val.length < 2) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final results = await geocoding.autocompletePlaces(val);
      if (mounted) {
        setState(() {
          _suggestions = results;
          _showSuggestions = results.isNotEmpty;
        });
      }
    });
  }

  void _onSelect(AutocompleteResult s) {
    _controller.text = s.text;
    setState(() {
      _suggestions = [];
      _showSuggestions = false;
    });
    _focusNode.unfocus();
    widget.onSelect(TripPlace(
      text: s.text,
      lat: s.lat,
      lng: s.lng,
      countryCode: s.countryCode,
    ));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: widget.dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: widget.placeholder,
                  hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFF97316)),
                  ),
                  suffixIcon: _controller.text.isNotEmpty
                      ? GestureDetector(
                          onTap: () {
                            _controller.clear();
                            widget.onClear?.call();
                            setState(() {
                              _suggestions = [];
                              _showSuggestions = false;
                            });
                          },
                          child: const Icon(Icons.close, size: 18),
                        )
                      : null,
                ),
                onChanged: _onChanged,
                onTap: () {
                  if (_suggestions.isNotEmpty) {
                    setState(() => _showSuggestions = true);
                  }
                },
              ),
            ),
          ],
        ),
        if (_showSuggestions)
          Container(
            margin: const EdgeInsets.only(left: 22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: ListView.builder(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _suggestions.length,
              itemBuilder: (context, index) {
                final s = _suggestions[index];
                final flag = s.countryCode != null
                    ? countries[s.countryCode]?.flag
                    : null;
                return InkWell(
                  onTap: () => _onSelect(s),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Icon(Icons.location_on,
                            size: 16, color: Colors.grey.shade500),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            s.text,
                            style: const TextStyle(fontSize: 13),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (flag != null) ...[
                          const SizedBox(width: 6),
                          Text(flag, style: const TextStyle(fontSize: 14)),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
