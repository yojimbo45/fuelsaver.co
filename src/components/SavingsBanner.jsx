import { formatPrice, formatPriceShort } from '../utils/format';

export default function SavingsBanner({ stations, fuelType, currency, decimals }) {
  if (!stations.length) return null;

  const withPrice = stations.filter((s) => s.prices[fuelType] != null);
  if (withPrice.length < 2) return null;

  const prices = withPrice.map((s) => s.prices[fuelType]);
  const cheapest = Math.min(...prices);
  const mostExpensive = Math.max(...prices);
  const saving = mostExpensive - cheapest;

  if (saving <= 0) return null;

  const tankSaving = saving * 50;

  return (
    <div className="savings-banner">
      <div className="savings-icon">$</div>
      <div className="savings-text">
        <div className="savings-amount">
          {formatPriceShort(tankSaving, currency, decimals)} saved on a full tank
        </div>
        <div className="savings-detail">
          {formatPrice(cheapest, currency, decimals)} → {formatPrice(mostExpensive, currency, decimals)}
          &nbsp;&nbsp;·&nbsp;&nbsp;{withPrice.length} stations compared
        </div>
      </div>
    </div>
  );
}
