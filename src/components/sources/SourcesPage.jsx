import './sources.css';

const GOVERNMENT_SOURCES = [
  { country: 'France', flag: '\u{1F1EB}\u{1F1F7}', source: "Minist\u00e8re de l'\u00C9conomie (Open Data)", url: 'https://data.economie.gouv.fr' },
  { country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', source: 'Tanker\u00F6nig (MTS-K / Bundeskartellamt)', url: 'https://creativecommons.tankerkoenig.de' },
  { country: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', source: 'Ministerio para la Transici\u00F3n Ecol\u00F3gica', url: 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help' },
  { country: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', source: 'MIMIT (Ministero delle Imprese e del Made in Italy)', url: 'https://www.mimit.gov.it/it/open-data' },
  { country: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', source: 'CMA Open Data (gov.uk mandate)', url: 'https://www.gov.uk/guidance/access-fuel-price-data' },
  { country: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}', source: 'DGEG (Dire\u00E7\u00E3o-Geral de Energia e Geologia)', url: 'https://precoscombustiveis.dgeg.gov.pt' },
  { country: 'Austria', flag: '\u{1F1E6}\u{1F1F9}', source: 'E-Control (Spritpreisrechner)', url: 'https://api.e-control.at/sprit/1.0/' },
  { country: 'Croatia', flag: '\u{1F1ED}\u{1F1F7}', source: 'Ministarstvo gospodarstva', url: 'https://mzoe-gor.hr' },
  { country: 'Slovenia', flag: '\u{1F1F8}\u{1F1EE}', source: 'goriva.si', url: 'https://goriva.si' },
  { country: 'Greece', flag: '\u{1F1EC}\u{1F1F7}', source: 'Fuel Price Observatory (\u03A0\u03B1\u03C1\u03B1\u03C4\u03B7\u03C1\u03B7\u03C4\u03AE\u03C1\u03B9\u03BF)', url: 'https://www.fuelprices.gr' },
  { country: 'Australia (NSW/TAS)', flag: '\u{1F1E6}\u{1F1FA}', source: 'NSW Government FuelCheck', url: 'https://api.onegov.nsw.gov.au' },
  { country: 'Australia (QLD)', flag: '\u{1F1E6}\u{1F1FA}', source: 'QLD Open Data', url: 'https://www.data.qld.gov.au' },
  { country: 'Australia (WA)', flag: '\u{1F1E6}\u{1F1FA}', source: 'FuelWatch WA', url: 'https://www.fuelwatch.wa.gov.au' },
  { country: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', source: 'OPINET (Korea National Oil Corporation)', url: 'https://www.opinet.co.kr' },
  { country: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}', source: 'data.gov.my', url: 'https://data.gov.my' },
  { country: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}', source: 'Pertamina (Government-regulated)', url: 'https://mypertamina.id' },
  { country: 'Chile', flag: '\u{1F1E8}\u{1F1F1}', source: 'CNE (Comisi\u00F3n Nacional de Energ\u00EDa)', url: 'https://www.cne.cl' },
  { country: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}', source: 'CRE via datos.gob.mx', url: 'https://datos.gob.mx' },
  { country: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}', source: 'Secretar\u00EDa de Energ\u00EDa', url: 'https://datos.gob.ar/dataset/energia-precios-surtidor' },
  { country: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}', source: 'ANP (Ag\u00EAncia Nacional do Petr\u00F3leo)', url: 'https://www.gov.br/anp' },
  { country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', source: 'Fuel Price Committee / MOENR', url: 'https://www.moenr.gov.ae' },
  { country: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}', source: 'Department of Energy', url: 'https://www.energy.gov.za' },
];

const THIRD_PARTY_SOURCES = [
  { country: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}', source: 'Comparis / Navisano', url: 'https://www.comparis.ch/benzin-preise' },
  { country: 'Ireland', flag: '\u{1F1EE}\u{1F1EA}', source: 'Pumps.ie', url: 'https://www.pumps.ie' },
  { country: 'Romania', flag: '\u{1F1F7}\u{1F1F4}', source: 'PretCarburant.ro', url: 'https://pretcarburant.ro' },
  { country: 'Hungary', flag: '\u{1F1ED}\u{1F1FA}', source: 'benzinkutarak.hu', url: 'https://www.benzinkutarak.hu' },
  { country: 'Czech Republic', flag: '\u{1F1E8}\u{1F1FF}', source: 'ceskybenzin.cz', url: 'https://www.ceskybenzin.cz' },
  { country: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}', source: 'OPET', url: 'https://www.opet.com.tr' },
  { country: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}', source: 'Brandstof-zoeker', url: 'https://www.brandstof-zoeker.nl' },
  { country: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}', source: 'Carbu.com', url: 'https://carbu.com/belgique' },
  { country: 'Luxembourg', flag: '\u{1F1F1}\u{1F1FA}', source: 'Carbu.com', url: 'https://carbu.com/luxembourg' },
  { country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', source: 'gogo.gs', url: 'https://gogo.gs' },
  { country: 'Finland', flag: '\u{1F1EB}\u{1F1EE}', source: 'polttoaine.net', url: 'https://polttoaine.net' },
  { country: 'Norway', flag: '\u{1F1F3}\u{1F1F4}', source: 'Drivstoffappen', url: 'https://drivstoffappen.no' },
  { country: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}', source: 'bensinpriser.nu', url: 'https://bensinpriser.nu' },
  { country: 'Denmark', flag: '\u{1F1E9}\u{1F1F0}', source: 'Retailer feeds (Q8, F24, Shell)', url: null },
  { country: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', source: 'Bangchak / PTT', url: 'https://oil-price.bangchak.co.th' },
  { country: 'Estonia', flag: '\u{1F1EA}\u{1F1EA}', source: 'gas.didnt.work (Waze data)', url: 'https://gas.didnt.work' },
  { country: 'Latvia', flag: '\u{1F1F1}\u{1F1FB}', source: 'gas.didnt.work (Waze data)', url: 'https://gas.didnt.work' },
  { country: 'Lithuania', flag: '\u{1F1F1}\u{1F1F9}', source: 'gas.didnt.work (Waze data)', url: 'https://gas.didnt.work' },
  { country: 'Poland', flag: '\u{1F1F5}\u{1F1F1}', source: 'gas.didnt.work (Waze data)', url: 'https://gas.didnt.work' },
  { country: 'India', flag: '\u{1F1EE}\u{1F1F3}', source: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
  { country: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}', source: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
];

function SourceRow({ country, flag, source, url }) {
  return (
    <tr className="sources-row">
      <td className="sources-country">
        <span className="sources-flag">{flag}</span>
        {country}
      </td>
      <td className="sources-name">{source}</td>
      <td className="sources-link">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        ) : (
          <span className="sources-na">N/A</span>
        )}
      </td>
    </tr>
  );
}

export default function SourcesPage() {
  return (
    <div className="sources-page">
      <div className="sources-container">
        <h1 className="sources-title">Data Sources</h1>

        <div className="sources-disclaimer">
          <strong>Disclaimer:</strong> FuelSaver is an independent app and is not affiliated with, endorsed by,
          or representing any government entity. Fuel price data is sourced from the official government APIs,
          open data platforms, and verified third-party databases listed below.
        </div>

        <section className="sources-section">
          <h2 className="sources-section-title">Government &amp; Official Sources</h2>
          <p className="sources-section-desc">
            Prices sourced directly from government agencies, regulatory bodies, and official open data platforms.
          </p>
          <div className="sources-table-wrapper">
            <table className="sources-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Source</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {GOVERNMENT_SOURCES.map((s) => (
                  <SourceRow key={s.country} {...s} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sources-section">
          <h2 className="sources-section-title">Third-Party &amp; Aggregator Sources</h2>
          <p className="sources-section-desc">
            Prices sourced from verified third-party databases, price aggregators, and community-driven platforms.
          </p>
          <div className="sources-table-wrapper">
            <table className="sources-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Source</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {THIRD_PARTY_SOURCES.map((s) => (
                  <SourceRow key={s.country} {...s} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="sources-footer">
          All prices are updated regularly. Each station in the app shows when its price was last verified.
          If you believe a data source is incorrect or missing, please contact us.
        </p>

        <p className="sources-footer">
          See also: <a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms of Use</a>
        </p>
      </div>
    </div>
  );
}
