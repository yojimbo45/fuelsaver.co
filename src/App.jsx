import { useState, useCallback } from 'react';
import './App.css';
import { COUNTRIES, DEFAULT_COUNTRY } from './services/countries';
import { useStations } from './hooks/useStations';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import SavingsBanner from './components/SavingsBanner';
import StationList from './components/StationList';
import FuelMap from './components/FuelMap';

function App() {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [fuelType, setFuelType] = useState(COUNTRIES[DEFAULT_COUNTRY].defaultFuel);
  const [highlightedStation, setHighlightedStation] = useState(null);

  const { stations, loading, error, searchCenter, search } = useStations();

  const countryData = COUNTRIES[country];

  const handleCountryDetected = useCallback((code) => {
    setCountry(code);
    setFuelType(COUNTRIES[code].defaultFuel);
  }, []);

  const handleSearch = useCallback(({ query, radiusKm, fuelType: ft, lat, lng, country: detectedCountry }) => {
    setFuelType(ft);
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
    search({ query: '', country, radiusKm: 10, fuelType, lat, lng });
  }, [country, fuelType, search]);

  const handleMapMove = useCallback(({ lat, lng, radiusKm }) => {
    search({ query: '', country, radiusKm, fuelType, lat, lng });
  }, [country, fuelType, search]);

  return (
    <>
      <Header />
      <div className="main-layout">
        <aside className="sidebar">
          <SearchBar onSearch={handleSearch} onCountryDetected={handleCountryDetected} />
          <SavingsBanner
            stations={stations}
            fuelType={fuelType}
            currency={countryData.currency}
          />
          <StationList
            stations={stations}
            fuelType={fuelType}
            currency={countryData.currency}
            loading={loading}
            error={error}
            onStationClick={handleStationClick}
            onStationHover={handleStationHover}
          />
        </aside>
        <FuelMap
          center={countryData.center}
          zoom={countryData.zoom}
          stations={stations}
          fuelType={fuelType}
          currency={countryData.currency}
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
