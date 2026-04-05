import '../config/env.dart';

const _brandDomains = <String, String>{
  // Global / multi-country
  'totalenergies': 'totalenergies.com',
  'total': 'totalenergies.com',
  'shell': 'shell.com',
  'bp': 'bp.com',
  'esso': 'esso.com',
  'exxonmobil': 'exxonmobil.com',
  'mobil': 'exxonmobil.com',
  'avia': 'avia-international.com',

  // France
  'leclerc': 'e.leclerc',
  'carrefour': 'carrefour.fr',
  'carrefour market': 'carrefour.fr',
  'carrefour contact': 'carrefour.fr',
  'intermarche': 'intermarche.com',
  'intermarch\u00E9': 'intermarche.com',
  'auchan': 'auchan.fr',
  'systeme u': 'magasins-u.com',
  'super u': 'magasins-u.com',
  'casino': 'groupe-casino.fr',
  'neste': 'neste.com',
  'oil!': 'oil-tankstellen.ch',

  // Germany
  'aral': 'aral.de',
  'jet': 'jet.de',
  'star': 'star.de',
  'agip': 'eni.com',
  'hoyer': 'hoyer-energie.de',
  'westfalen': 'westfalen.com',
  'classic': 'classic-oil.de',
  'hem': 'hem-tankstelle.de',
  'orlen': 'orlen.de',

  // UK
  'tesco': 'tesco.com',
  "sainsbury's": 'sainsburys.co.uk',
  'sainsburys': 'sainsburys.co.uk',
  'asda': 'asda.com',
  'morrisons': 'morrisons.com',
  'texaco': 'texaco.com',
  'murco': 'murco.co.uk',

  // Spain
  'repsol': 'repsol.com',
  'cepsa': 'cepsa.com',
  'galp': 'galp.com',
  'petronor': 'petronor.com',
  'ballenoil': 'ballenoil.es',
  'bonarea': 'bonarea.com',
  'plenoil': 'plenoil.es',
  'plenergy': 'plenergy.es',
  'moeve': 'moeve.com',
  'petroprix': 'petroprix.com',
  'eroski': 'eroski.es',
  'alcampo': 'alcampo.es',
  'meroil': 'meroil.es',
  'dyneff': 'dyneff.es',
  'disa': 'disa.com',
  'gasexpress': 'gasexpress.es',
  'costco': 'costco.es',
  'petrocat': 'petrocat.es',
  'autonetoil': 'autonetoil.com',
  'hafesa': 'hafesa.es',
  'valcarce': 'valcarce.com',

  // Italy
  'eni': 'eni.com',
  'ip': 'gruppoapi.com',
  'api-ip': 'gruppoapi.com',
  'q8': 'q8.it',
  'totalerg': 'totalenergies.com',
  'tamoil': 'tamoil.it',
  'api': 'gruppoapi.com',

  // Switzerland
  'migrol': 'migrol.ch',
  'coop': 'coop.ch',
  'coop pronto': 'coop.ch',
  'agrola': 'agrola.ch',
  'socar': 'socar.com',

  // Netherlands
  'tinq': 'tinq.nl',
  'tango': 'tango.nl',
  'argos': 'argos-energies.nl',
  'makro': 'makro.nl',
  'lukoil': 'lukoil.com',
  'ok': 'ok.nl',

  // Belgium
  'dats 24': 'dats24.be',
  'dats24': 'dats24.be',
  'octa+': 'octaplus.be',

  // Ireland
  'circle k': 'circlek.com',
  'applegreen': 'applegreenstores.com',
  'maxol': 'maxol.ie',
  'emo': 'emo.ie',
  'amber': 'amberstation.ie',
  'certa': 'certa.ie',
  'inver': 'inver.ie',

  // Norway
  'uno-x': 'unox.no',
  'uno x': 'unox.no',
  'yx': 'yx.no',
  'best': 'best.no',
  'automat 1': 'automat1.no',

  // Sweden
  'okq8': 'okq8.se',
  'preem': 'preem.se',
  'st1': 'st1.se',
  'tanka': 'tanka.se',
  'ingo': 'ingo.se',
  'qstar': 'qstar.se',

  // Baltic States
  'alexela': 'alexela.ee',
  'terminal': 'terminaloil.ee',
  'olerex': 'olerex.ee',
  'viada': 'viada.lt',
  'virsi': 'virsi.lv',

  // Poland
  'moya': 'moya.pl',
  'lotos': 'lotos.pl',
  'amic': 'amic.pl',

  // Croatia
  'ina': 'ina.hr',
  'tifon': 'tifon.hr',
  'crodux': 'crodux.hr',

  // Slovenia
  'petrol': 'petrol.si',
  'mol': 'molgroup.info',

  // Portugal
  'prio': 'prio.pt',

  // Austria
  'omv': 'omv.com',
  'avanti': 'avanti.at',
  'turm\u00F6l': 'turmoel.at',
  'iq': 'iq-energy.at',

  // South Korea
  'sk energy': 'skenergy.com',
  'gs caltex': 'gscaltex.com',
  's-oil': 's-oil.com',
  'hyundai oilbank': 'oilbank.co.kr',

  // Chile
  'copec': 'copec.cl',
  'terpel': 'terpel.com',
  'enex': 'enex.cl',
  'aramco': 'aramco.com',

  // Australia
  'caltex': 'caltex.com.au',
  '7-eleven': '7eleven.com.au',
  'united': 'unitedpetroleum.com.au',
  'coles express': 'coles.com.au',
  'woolworths': 'woolworths.com.au',
  'ampol': 'ampol.com.au',

  // UAE
  'adnoc': 'adnoc.ae',
  'enoc': 'enoc.com',
  'eppco': 'eppco.ae',
  'emarat': 'emarat.ae',

  // Mexico
  'pemex': 'pemex.com',
  'oxxo gas': 'oxxo.com',
  'oxxo': 'oxxo.com',
  'g500': 'g500.mx',
  'arco': 'arco.com',
  'chevron': 'chevron.com',
  'hidrosina': 'hidrosina.com.mx',
  'valero': 'valero.com',
  'marathon': 'marathonpetroleum.com',
  '76': '76.com',

  // Brazil
  'petrobras': 'petrobras.com.br',
  'ipiranga': 'ipiranga.com.br',
  'ale': 'ale.com.br',
  'vibra': 'vibraenergia.com.br',

  // Argentina
  'ypf': 'ypf.com',
  'axion energy': 'axionenergy.com',
  'axion': 'axionenergy.com',
  'puma': 'pumaenergy.com',
  'gulf': 'gulfoil.com',

  // Turkey
  'petrol ofisi': 'petrolofisi.com.tr',
  'opet': 'opet.com.tr',
  'aytemiz': 'aytemiz.com.tr',
  'tp': 'tppetrol.com.tr',
  'alpet': 'alpet.com.tr',

  // Denmark
  'f24': 'f24.dk',

  // Finland
  'abc': 'abc.fi',
  'teboil': 'teboil.fi',

  // Greece
  'aegean': 'aegeanoil.gr',
  'eko': 'eko.gr',
  'avin': 'avinoil.gr',

  // Japan
  'eneos': 'eneos.co.jp',
  'idemitsu': 'idemitsu.com',
  'cosmo': 'cosmo-oil.co.jp',

  // Thailand
  'ptt': 'pttplc.com',
  'bangchak': 'bangchak.co.th',
  'susco': 'susco.co.th',

  // Malaysia
  'petronas': 'petronas.com',
  'bhp': 'bhppetrol.com.my',

  // India
  'indian oil': 'iocl.com',
  'hindustan petroleum': 'hindustanpetroleum.com',
  'reliance': 'reliancepetroleum.com',

  // New Zealand
  'z energy': 'z.co.nz',
  'gull': 'gull.nz',
  'waitomo': 'waitomo.co.nz',
  'npd': 'npd.co.nz',

  // South Africa
  'sasol': 'sasol.com',
  'engen': 'engen.co.za',

  // US / Canada
  'speedway': 'speedway.com',
  'sunoco': 'sunoco.com',
  'citgo': 'citgo.com',
  'phillips 66': 'phillips66.com',
  'sinclair': 'sinclair.com',
  'casey\'s': 'caseys.com',
  'wawa': 'wawa.com',
  'sheetz': 'sheetz.com',
  'quiktrip': 'quiktrip.com',
  'buc-ee\'s': 'buc-ees.com',
  'petro-canada': 'petro-canada.ca',
  'pioneer': 'pioneerpetroleum.com',
  'ultramar': 'ultramar.ca',
  'husky': 'huskyenergy.com',
  'co-op': 'coopconnection.ca',
};

// Direct logo URLs for brands where domain proxy doesn't work
const _brandDirectLogos = <String, String>{
  'leclerc':
      'https://upload.wikimedia.org/wikipedia/commons/e/ed/Logo_E.Leclerc_Sans_le_texte.svg',
  'intermarch':
      'https://play-lh.googleusercontent.com/y8py7OoxNFqBibg-CZrmIACpVLocBOa7yy3U4F3S8G6Fqjljb7g8w-y4WhaGKtAbKzk',
};

final _cache = <String, String?>{};

String? getBrandLogoUrl(String? brand) {
  if (brand == null || brand.isEmpty) return null;
  final key = brand.toLowerCase().trim();
  if (_cache.containsKey(key)) return _cache[key];

  // Check direct logo overrides first
  for (final entry in _brandDirectLogos.entries) {
    if (key == entry.key || key.contains(entry.key)) {
      _cache[key] = entry.value;
      return entry.value;
    }
  }

  // Exact match
  var domain = _brandDomains[key];

  // Partial match
  if (domain == null) {
    for (final entry in _brandDomains.entries) {
      if (key.contains(entry.key) || entry.key.contains(key)) {
        domain = entry.value;
        break;
      }
    }
  }

  if (domain == null) {
    _cache[key] = null;
    return null;
  }

  // Use worker proxy (same as website) with clearbit fallback
  final workerUrl = Env.workerUrl;
  final url = workerUrl.isNotEmpty
      ? '$workerUrl/logo/$domain?v=2'
      : 'https://logo.clearbit.com/$domain?size=64';

  _cache[key] = url;
  return url;
}
