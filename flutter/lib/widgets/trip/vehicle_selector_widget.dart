import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/trip_models.dart';
import '../../services/vehicle_service.dart' as vehicle_api;

class VehicleSelectorWidget extends StatefulWidget {
  final ValueChanged<Vehicle> onSelect;

  const VehicleSelectorWidget({super.key, required this.onSelect});

  @override
  State<VehicleSelectorWidget> createState() => _VehicleSelectorWidgetState();
}

class _VehicleSelectorWidgetState extends State<VehicleSelectorWidget> {
  final _controller = TextEditingController();
  List<Vehicle> _suggestions = [];
  bool _loading = false;
  Timer? _debounce;

  void _onChanged(String val) {
    _debounce?.cancel();
    if (val.length < 2) {
      setState(() => _suggestions = []);
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 300), () async {
      setState(() => _loading = true);
      final results = await vehicle_api.searchVehicles(val);
      if (mounted) {
        setState(() {
          _suggestions = results;
          _loading = false;
        });
      }
    });
  }

  void _onSelect(Vehicle v) {
    _controller.text = '${v.make} ${v.model}';
    setState(() => _suggestions = []);
    widget.onSelect(v);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _controller,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Search your car...',
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
            suffixIcon: _loading
                ? const Padding(
                    padding: EdgeInsets.all(10),
                    child: SizedBox(
                        width: 16,
                        height: 16,
                        child:
                            CircularProgressIndicator(strokeWidth: 2)),
                  )
                : null,
          ),
          onChanged: _onChanged,
        ),
        if (_suggestions.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 250),
            margin: const EdgeInsets.only(top: 4),
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
                final v = _suggestions[index];
                return InkWell(
                  onTap: () => _onSelect(v),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${v.make} ${v.model}',
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                        ),
                        Text(
                          '${v.consumption} L/100km',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade500),
                        ),
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
