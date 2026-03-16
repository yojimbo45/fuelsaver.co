import { useState, useMemo } from 'react';
import { formatPrice, formatUpdated } from '../utils/format';
import { formatDistance } from '../utils/geo';
import { getBrandLogoUrl } from '../utils/brandLogo';

export default function StationList({
  stations,
  fuelType,
  currency,
  loading,
  error,
  onStationClick,
  onStationHover,
}) {
  const [sortBy, setSortBy] = useState('price'); // 'price' | 'distance'

  const sorted = useMemo(() => {
    const withPrice = stations.filter((s) => s.prices[fuelType] != null);
    if (sortBy === 'price') {
      return [...withPrice].sort((a, b) => a.prices[fuelType] - b.prices[fuelType]);
    }
    return [...withPrice].sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [stations, fuelType, sortBy]);

  const cheapestPrice = sorted.length ? sorted[0]?.prices[fuelType] : null;
  const expensivePrice = sorted.length ? sorted[sorted.length - 1]?.prices[fuelType] : null;

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <span>Searching stations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">!</div>
        <span>{error}</span>
      </div>
    );
  }

  if (!stations.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">{'\u26FD'}</div>
        <span>Search for a location to find nearby fuel stations</span>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">{'\u26FD'}</div>
        <span>No stations found with {fuelType} in this area</span>
      </div>
    );
  }

  return (
    <>
      <div className="station-list-header">
        <span className="station-count">{sorted.length} stations</span>
        <div className="sort-toggle">
          <button
            className={`sort-btn ${sortBy === 'price' ? 'active' : ''}`}
            onClick={() => setSortBy('price')}
          >
            By price
          </button>
          <button
            className={`sort-btn ${sortBy === 'distance' ? 'active' : ''}`}
            onClick={() => setSortBy('distance')}
          >
            By distance
          </button>
        </div>
      </div>
      <div className="station-list">
        {sorted.map((station, idx) => {
          const price = station.prices[fuelType];
          const isCheapest = price === cheapestPrice;
          const isExpensive = price === expensivePrice && sorted.length > 1;
          const savingVsExpensive = expensivePrice != null ? expensivePrice - price : 0;

          const logoUrl = getBrandLogoUrl(station.brand);

          return (
            <div
              key={station.id}
              className={`station-card ${isCheapest ? 'cheapest' : ''} ${isExpensive ? 'expensive' : ''}`}
              onClick={() => onStationClick?.(station)}
              onMouseEnter={() => onStationHover?.(station)}
              onMouseLeave={() => onStationHover?.(null)}
            >
              {logoUrl ? (
                <img
                  className="station-logo"
                  src={logoUrl}
                  alt={station.brand}
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div className="station-rank" style={logoUrl ? { display: 'none' } : undefined}>{idx + 1}</div>
              <div className="station-info">
                <div className="station-brand">
                  {station.brand}
                  {station.id?.includes('-DEMO-') && (
                    <span className="station-demo-badge">Demo</span>
                  )}
                </div>
                <div className="station-address">
                  {station.address}{station.city ? `, ${station.city}` : ''}
                </div>
                {station.distance != null && (
                  <div className="station-distance">{formatDistance(station.distance)}</div>
                )}
              </div>
              <div className="station-price-col">
                <div className="station-price">{formatPrice(price, currency)}</div>
                {station.updatedAt && (
                  <div className="station-updated">
                    {formatUpdated(station.updatedAt)}
                  </div>
                )}
                {savingVsExpensive > 0.001 && (
                  <div className="station-saving saving-positive">
                    -{formatPrice(savingVsExpensive, currency)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
