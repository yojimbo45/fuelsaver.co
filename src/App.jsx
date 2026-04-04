import { useState, useCallback, useEffect } from 'react';
import './App.css';
import { COUNTRIES, DEFAULT_COUNTRY } from './services/countries';
import { useStations } from './hooks/useStations';
import { detectCountryFromCoords } from './utils/geo';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import SavingsBanner from './components/SavingsBanner';
import StationList from './components/StationList';
import FuelMap from './components/FuelMap';

const DEFAULT_TITLE = 'FuelSaver — Compare Fuel Prices in 26 Countries | Find Cheapest Gas Stations';
const DEFAULT_DESC = 'Compare real-time fuel prices across 26 countries including France, Germany, Spain, UK, Italy, Australia, India, Brazil, and more. Find the cheapest gas stations near you and save money on every fill-up.';

function App() {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [fuelType, setFuelType] = useState(COUNTRIES[DEFAULT_COUNTRY].defaultFuel);
  const [highlightedStation, setHighlightedStation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { stations, loading, error, searchCenter, search } = useStations();

  // Dynamic document.title and meta description for SEO
  useEffect(() => {
    const countryName = COUNTRIES[country]?.name || '';
    const fuelLabel = COUNTRIES[country]?.fuelTypes.find(f => f.id === fuelType)?.label || '';

    if (searchQuery && countryName) {
      document.title = `Fuel Prices in ${searchQuery} (${countryName}) — ${fuelLabel} | FuelSaver`;
      document.querySelector('meta[name="description"]')?.setAttribute('content',
        `Compare ${fuelLabel} prices at gas stations in ${searchQuery}, ${countryName}. Find the cheapest fuel near you with real-time prices on FuelSaver.`
      );
    } else {
      document.title = DEFAULT_TITLE;
      document.querySelector('meta[name="description"]')?.setAttribute('content', DEFAULT_DESC);
    }
  }, [searchQuery, country, fuelType]);

  const countryData = COUNTRIES[country];

  const handleCountryDetected = useCallback((code) => {
    setCountry(code);
    setFuelType(COUNTRIES[code].defaultFuel);
  }, []);

  const handleSearch = useCallback(({ query, radiusKm, fuelType: ft, lat, lng, country: detectedCountry }) => {
    setFuelType(ft);
    setSearchQuery(query || '');
    if (detectedCountry) {
      setCountry(detectedCountry);
    }
    search({ query, country: detectedCountry || country, radiusKm, fuelType: ft, lat, lng });
  }, [country, search]);

  const [hoveredStation, setHoveredStation] = useState(null);

  const handleStationClick = useCallback((station) => {
    if (!station) return;
    setHighlightedStation(station);
  }, []);

  const handleStationHover = useCallback((station) => {
    setHoveredStation(station);
  }, []);

  const handleLocate = useCallback(({ lat, lng }) => {
    search({ query: '', country, radiusKm: 15, fuelType, lat, lng });
  }, [country, fuelType, search]);

  const handleMapMove = useCallback(({ lat, lng, radiusKm }) => {
    const detected = detectCountryFromCoords(lat, lng);
    const targetCountry = detected && COUNTRIES[detected] ? detected : country;

    if (targetCountry !== country) {
      setCountry(targetCountry);
      setFuelType(COUNTRIES[targetCountry].defaultFuel);
      search({ query: '', country: targetCountry, radiusKm, fuelType: COUNTRIES[targetCountry].defaultFuel, lat, lng, skipFly: true });
    } else {
      search({ query: '', country: targetCountry, radiusKm, fuelType, lat, lng, skipFly: true });
    }
  }, [country, fuelType, search]);

  const handleFuelChange = useCallback((newFuel) => {
    setFuelType(newFuel);
    if (searchCenter) {
      search({ query: '', country, radiusKm: 15, fuelType: newFuel, lat: searchCenter.lat, lng: searchCenter.lng, skipFly: true });
    }
  }, [country, searchCenter, search]);

  return (
    <>
      <Header />
      <div className="main-layout">
        <aside className="sidebar">
          <SearchBar onSearch={handleSearch} onCountryDetected={handleCountryDetected} activeFuelType={fuelType} />
          <SavingsBanner
            stations={stations}
            fuelType={fuelType}
            currency={countryData.currency}
            decimals={countryData.decimals}
          />
          <StationList
            stations={stations}
            fuelType={fuelType}
            currency={countryData.currency}
            decimals={countryData.decimals}
            countryCode={country}
            loading={loading}
            error={error}
            onStationClick={handleStationClick}
            onStationHover={handleStationHover}
            onFuelChange={handleFuelChange}
          />
        </aside>
        <FuelMap
          center={countryData.center}
          zoom={countryData.zoom}
          stations={stations}
          fuelType={fuelType}
          currency={countryData.currency}
          decimals={countryData.decimals}
          countryCode={country}
          searchCenter={searchCenter}
          highlightedStation={highlightedStation}
          hoveredStation={hoveredStation}
          onLocate={handleLocate}
          onMapMove={handleMapMove}
        />
      </div>
    </>
  );
}

export default App;
