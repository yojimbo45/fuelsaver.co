import { useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { createCircleGeoJSON, haversineDistance } from '../utils/geo';
import { formatPrice, formatUpdated } from '../utils/format';
import { COUNTRIES } from '../services/countries';
import { getBrandLogoUrl } from '../utils/brandLogo';

function getMapStyle() {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (token) {
    // MapLibre can't resolve mapbox:// protocol, so use Mapbox raster tiles directly
    return {
      version: 8,
      sources: {
        'mapbox-streets': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`,
          ],
          tileSize: 512,
          attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'mapbox-streets', type: 'raster', source: 'mapbox-streets' }],
      glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    };
  }
  // Fallback to OSM raster tiles
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
}

export default function FuelMap({
  center,
  zoom,
  stations,
  fuelType,
  currency,
  countryCode,
  searchCenter,
  highlightedStation,
  hoveredStation,
  onLocate,
  onMapMove,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const hoverPopupRef = useRef(null);
  const clickPopupRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const detailBuilderRef = useRef(null);
  const skipMoveRef = useRef(false);
  const moveDebounceRef = useRef(null);
  const onMapMoveRef = useRef(onMapMove);
  onMapMoveRef.current = onMapMove;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: center,
      zoom: zoom,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Geolocate button
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geolocate, 'top-right');

    geolocate.on('geolocate', (e) => {
      if (onLocate && e.coords) {
        onLocate({ lat: e.coords.latitude, lng: e.coords.longitude });
      }
    });

    // Auto-search when user pans or zooms the map
    map.on('moveend', () => {
      if (skipMoveRef.current) {
        skipMoveRef.current = false;
        return;
      }
      // Only search when zoomed in enough (zoom >= 9 ≈ city level)
      if (map.getZoom() < 9) return;

      clearTimeout(moveDebounceRef.current);
      moveDebounceRef.current = setTimeout(() => {
        const c = map.getCenter();
        const bounds = map.getBounds();
        // Radius = distance from center to edge of visible area
        const radiusKm = haversineDistance(
          c.lat, c.lng,
          bounds.getNorth(), c.lng
        );
        onMapMoveRef.current?.({ lat: c.lat, lng: c.lng, radiusKm: Math.min(radiusKm, 25) });
      }, 600);
    });

    map.on('load', () => {
      // High-res fuel pump icon (drawn at 2x for crisp scaling)
      const ratio = 2;
      const logical = 32;
      const size = logical * ratio;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pump body (rounded rect)
      const bx = 6, by = 7, bw = 14, bh = 17, br = 2;
      ctx.beginPath();
      ctx.moveTo(bx + br, by);
      ctx.lineTo(bx + bw - br, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
      ctx.lineTo(bx + bw, by + bh - br);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
      ctx.lineTo(bx + br, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
      ctx.lineTo(bx, by + br);
      ctx.quadraticCurveTo(bx, by, bx + br, by);
      ctx.fill();

      // Display window on pump body
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(9, 10, 8, 5);
      ctx.fillStyle = '#ffffff';

      // Nozzle hose
      ctx.beginPath();
      ctx.moveTo(20, 11);
      ctx.lineTo(24, 8);
      ctx.lineTo(24, 18);
      ctx.lineTo(22, 20);
      ctx.stroke();

      // Nozzle tip
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(22, 20);
      ctx.lineTo(22, 23);
      ctx.stroke();
      ctx.lineWidth = 1.5;

      // Base plate
      ctx.fillRect(5, 25, 16, 2);

      // Top handle
      ctx.fillRect(9, 5, 8, 2);

      map.addImage('fuel-icon', { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data }, { pixelRatio: ratio });

      mapLoadedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      mapLoadedRef.current = false;
      clearTimeout(moveDebounceRef.current);
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update center/zoom when country changes (skip if a search will fitBounds)
  useEffect(() => {
    if (!mapRef.current || searchCenter) return;
    skipMoveRef.current = true;
    mapRef.current.flyTo({ center, zoom, duration: 1000 });
  }, [center, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw search radius circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawCircle = () => {
      // Remove existing circle layers/source
      if (map.getLayer('radius-fill')) map.removeLayer('radius-fill');
      if (map.getLayer('radius-line')) map.removeLayer('radius-line');
      if (map.getSource('radius')) map.removeSource('radius');

      if (!searchCenter) return;

      const circleGeo = createCircleGeoJSON(
        [searchCenter.lng, searchCenter.lat],
        searchCenter.radiusKm
      );

      map.addSource('radius', { type: 'geojson', data: circleGeo });

      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0.08 },
      });

      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: {
          'line-color': '#f97316',
          'line-width': 2,
          'line-opacity': 0.5,
          'line-dasharray': [4, 4],
        },
      });

      // Fit map to circle bounds
      const coords = circleGeo.geometry.coordinates[0];
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      skipMoveRef.current = true;
      map.fitBounds(bounds, { padding: 50, duration: 800 });
    };

    if (mapLoadedRef.current) {
      drawCircle();
    } else {
      map.on('load', drawCircle);
    }
  }, [searchCenter]);

  // Place station markers using native map layers (no DOM lag)
  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
    if (clickPopupRef.current) { clickPopupRef.current.remove(); clickPopupRef.current = null; }

    // Build GeoJSON from stations
    const withPrice = stations
      .filter((s) => s.prices[fuelType] != null && s.lat != null && s.lng != null)
      .sort((a, b) => a.prices[fuelType] - b.prices[fuelType]);

    const minPrice = withPrice.length ? withPrice[0].prices[fuelType] : 0;
    const maxPrice = withPrice.length ? withPrice[withPrice.length - 1].prices[fuelType] : 0;

    // Get fuel type labels for the current country
    const countryConfig = COUNTRIES[countryCode] || {};
    const fuelLabels = {};
    for (const ft of countryConfig.fuelTypes || []) {
      fuelLabels[ft.id] = ft.label;
    }

    const features = withPrice.map((station, rankIdx) => {
      const price = station.prices[fuelType];
      let color = '#f97316';
      if (withPrice.length > 1) {
        const ratio = (price - minPrice) / (maxPrice - minPrice || 1);
        if (ratio < 0.25) color = '#22c55e';
        else if (ratio > 0.75) color = '#ef4444';
      }
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [station.lng, station.lat] },
        properties: {
          stationId: station.id,
          rank: String(rankIdx + 1),
          color,
          brand: station.brand,
          logoUrl: getBrandLogoUrl(station.brand) || '',
          price: formatPrice(price, currency),
          address: station.address + (station.city ? ', ' + station.city : ''),
          allPrices: JSON.stringify(station.prices),
          updatedAt: station.updatedAt || '',
          distance: station.distance != null ? station.distance.toFixed(1) : '',
          services: JSON.stringify(station.services || []),
          is24h: station.is24h ? 'true' : '',
          outOfStock: JSON.stringify(station.outOfStock || []),
        },
      };
    });

    const geojson = { type: 'FeatureCollection', features };

    // Service → icon mapping for French stations
    const SERVICE_ICONS = {
      'Toilettes publiques': { icon: '\uD83D\uDEBD', label: 'WC' },
      'Boutique alimentaire': { icon: '\uD83C\uDFEA', label: 'Shop' },
      'Boutique non alimentaire': { icon: '\uD83D\uDECD\uFE0F', label: 'Shop' },
      'DAB (Distributeur automatique de billets)': { icon: '\uD83D\uDCB3', label: 'ATM' },
      'Station de gonflage': { icon: '\uD83D\uDCA8', label: 'Air' },
      'Lavage automatique': { icon: '\uD83E\uDEE7', label: 'Wash' },
      'Lavage manuel': { icon: '\uD83E\uDEE7', label: 'Wash' },
      'Services réparation / entretien': { icon: '\uD83D\uDD27', label: 'Repair' },
      'Carburant additivé': { icon: '\u26FD', label: 'Additive' },
      'Piste poids lourds': { icon: '\uD83D\uDE9B', label: 'Truck' },
      'Relais colis': { icon: '\uD83D\uDCE6', label: 'Parcel' },
      'Vente de pétrole lampant': { icon: '\uD83E\uDE94', label: 'Lamp oil' },
      'Aire de camping-cars': { icon: '\uD83D\uDE90', label: 'Camper' },
      'Vente de gaz domestique (Butane, Propane)': { icon: '\uD83D\uDD25', label: 'Gas' },
      'Bornes électriques': { icon: '\u26A1', label: 'EV' },
      'Automate CB 24/24': { icon: '\uD83C\uDFE7', label: 'Card 24/7' },
      'Wifi': { icon: '\uD83D\uDCF6', label: 'WiFi' },
      'Location de véhicule': { icon: '\uD83D\uDE97', label: 'Rental' },
    };

    // Helper: build detail popup HTML (stored in ref so click handler stays current)
    detailBuilderRef.current = (props) => {
      const prices = JSON.parse(props.allPrices || '{}');
      const outOfStock = JSON.parse(props.outOfStock || '[]');
      const services = JSON.parse(props.services || '[]');
      const is24h = props.is24h === 'true';

      // Build price rows, marking out-of-stock fuels
      let priceRows = '';
      for (const [fuelId, val] of Object.entries(prices)) {
        if (val == null) continue;
        const label = fuelLabels[fuelId] || fuelId;
        const isSelected = fuelId === fuelType;
        const isOut = outOfStock.some(
          (s) => s.toLowerCase() === fuelId.toLowerCase() || s.toLowerCase() === label.toLowerCase()
        );
        if (isOut) {
          priceRows += `<tr class="map-popup-out-of-stock">
            <td class="map-popup-fuel-label"><s>${label}</s></td>
            <td class="map-popup-fuel-price map-popup-oos-text">out of stock</td>
          </tr>`;
        } else {
          priceRows += `<tr class="${isSelected ? 'map-popup-selected' : ''}">
            <td class="map-popup-fuel-label">${label}</td>
            <td class="map-popup-fuel-price">${formatPrice(val, currency)}</td>
          </tr>`;
        }
      }
      // Add out-of-stock fuels that aren't already in prices
      for (const oos of outOfStock) {
        const alreadyListed = Object.keys(prices).some(
          (k) => k.toLowerCase() === oos.toLowerCase() || (fuelLabels[k] || '').toLowerCase() === oos.toLowerCase()
        );
        if (!alreadyListed) {
          priceRows += `<tr class="map-popup-out-of-stock">
            <td class="map-popup-fuel-label"><s>${oos}</s></td>
            <td class="map-popup-fuel-price map-popup-oos-text">out of stock</td>
          </tr>`;
        }
      }

      const updatedStr = props.updatedAt ? formatUpdated(props.updatedAt) : '';
      const distStr = props.distance ? `${props.distance} km` : '';
      const meta = [updatedStr, distStr].filter(Boolean).join(' \u00B7 ');

      const logoHtml = props.logoUrl
        ? `<img class="map-popup-logo" src="${props.logoUrl}" alt="" onerror="this.style.display='none'" />`
        : '';

      // 24/7 badge
      const badgeHtml = is24h
        ? '<div class="map-popup-badge-24h">24/7</div>'
        : '';

      // Service icons
      let servicesHtml = '';
      if (services.length > 0) {
        const seen = new Set();
        const icons = services
          .map((s) => {
            // Try exact match, then partial match
            let match = SERVICE_ICONS[s];
            if (!match) {
              const key = Object.keys(SERVICE_ICONS).find(
                (k) => s.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(s.toLowerCase())
              );
              if (key) match = SERVICE_ICONS[key];
            }
            if (!match || seen.has(match.label)) return '';
            seen.add(match.label);
            return `<span class="map-popup-service" data-tooltip="${match.label}">${match.icon}</span>`;
          })
          .filter(Boolean)
          .join('');
        if (icons) {
          servicesHtml = `<div class="map-popup-services">${icons}</div>`;
        }
      }

      return `<div class="map-popup map-popup-detail">
        <div class="map-popup-header">${logoHtml}<div class="map-popup-brand">${props.brand}</div></div>
        <div class="map-popup-address">${props.address}</div>
        ${badgeHtml}
        ${priceRows ? `<table class="map-popup-prices">${priceRows}</table>` : ''}
        ${servicesHtml}
        ${meta ? `<div class="map-popup-meta">${meta}</div>` : ''}
      </div>`;
    };

    // Update or create the source
    const source = map.getSource('stations');
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('stations', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });

      // Cluster circle layer
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'stations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f97316',
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 20, 32],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Cluster count label
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'stations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 14,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Click cluster to zoom in
      map.on('click', 'clusters', (e) => {
        const feat = e.features[0];
        const clusterId = feat.properties.cluster_id;
        map.getSource('stations').getClusterExpansionZoom(clusterId, (err, z) => {
          if (err) return;
          skipMoveRef.current = true;
          map.easeTo({ center: feat.geometry.coordinates, zoom: z });
        });
      });
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });

      // Circle layer for individual (unclustered) station dots
      map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 16,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Symbol layer for fuel pump icon (unclustered only)
      map.addLayer({
        id: 'stations-label',
        type: 'symbol',
        source: 'stations',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'fuel-icon',
          'icon-size': 0.9,
          'icon-allow-overlap': true,
        },
      });

      // Pointer cursor on hover
      map.on('mouseenter', 'stations-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'stations-circle', () => {
        map.getCanvas().style.cursor = '';
        if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
      });

      // Small tooltip on hover
      map.on('mousemove', 'stations-circle', (e) => {
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const coords = f.geometry.coordinates.slice();
        const { brand, price } = f.properties;

        if (hoverPopupRef.current) hoverPopupRef.current.remove();
        hoverPopupRef.current = new maplibregl.Popup({
          offset: 20,
          closeButton: false,
          closeOnClick: false,
        })
          .setLngLat(coords)
          .setHTML(`<div class="map-popup"><strong>${brand}</strong> &mdash; ${price}</div>`)
          .addTo(map);
      });

      // Detailed popup on click
      map.on('click', 'stations-circle', (e) => {
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const coords = f.geometry.coordinates.slice();

        if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
        if (clickPopupRef.current) clickPopupRef.current.remove();

        clickPopupRef.current = new maplibregl.Popup({
          offset: 24,
          closeButton: true,
          closeOnClick: true,
          maxWidth: '280px',
        })
          .setLngLat(coords)
          .setHTML(detailBuilderRef.current(f.properties))
          .addTo(map);
      });
    }
  }, [stations, fuelType, currency, countryCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mapLoadedRef.current) {
      updateMarkers();
    } else {
      map.on('load', updateMarkers);
    }
  }, [updateMarkers]);

  // Halo on hover from station list (no zoom)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const hlId = hoveredStation?.id || '';

    // Add the halo layer once (rendered below the station circles)
    if (!map.getLayer('station-halo')) {
      map.addLayer(
        {
          id: 'station-halo',
          type: 'circle',
          source: 'stations',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 26,
            'circle-color': '#f97316',
            'circle-opacity': 0,
            'circle-stroke-width': 0,
          },
        },
        'stations-circle' // insert below station circles
      );
    }

    // Toggle halo visibility via opacity
    map.setPaintProperty('station-halo', 'circle-opacity', [
      'case',
      ['==', ['get', 'stationId'], hlId],
      0.25,
      0,
    ]);
    map.setPaintProperty('station-halo', 'circle-radius', [
      'case',
      ['==', ['get', 'stationId'], hlId],
      26,
      0,
    ]);
  }, [hoveredStation]);

  // Fly to station on click from station list
  useEffect(() => {
    if (!mapRef.current || !highlightedStation) return;
    skipMoveRef.current = true;
    mapRef.current.flyTo({
      center: [highlightedStation.lng, highlightedStation.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 500,
    });
  }, [highlightedStation]);

  return <div ref={containerRef} className="map-container" />;
}
