/**
 * Top cities per country for SEO sitemap generation and dynamic meta tags.
 * Each city has: slug (URL-safe), name (display), lat, lng.
 * Start with France top 20 by population — extend to other countries over time.
 */
export const TOP_CITIES = {
  FR: [
    { slug: 'paris', name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { slug: 'marseille', name: 'Marseille', lat: 43.2965, lng: 5.3698 },
    { slug: 'lyon', name: 'Lyon', lat: 45.7640, lng: 4.8357 },
    { slug: 'toulouse', name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
    { slug: 'nice', name: 'Nice', lat: 43.7102, lng: 7.2620 },
    { slug: 'nantes', name: 'Nantes', lat: 47.2184, lng: -1.5536 },
    { slug: 'strasbourg', name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
    { slug: 'montpellier', name: 'Montpellier', lat: 43.6108, lng: 3.8767 },
    { slug: 'bordeaux', name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
    { slug: 'lille', name: 'Lille', lat: 50.6292, lng: 3.0573 },
    { slug: 'rennes', name: 'Rennes', lat: 48.1173, lng: -1.6778 },
    { slug: 'reims', name: 'Reims', lat: 49.2583, lng: 4.0317 },
    { slug: 'saint-etienne', name: 'Saint-Étienne', lat: 45.4397, lng: 4.3872 },
    { slug: 'le-havre', name: 'Le Havre', lat: 49.4944, lng: 0.1079 },
    { slug: 'toulon', name: 'Toulon', lat: 43.1242, lng: 5.9280 },
    { slug: 'grenoble', name: 'Grenoble', lat: 45.1885, lng: 5.7245 },
    { slug: 'dijon', name: 'Dijon', lat: 47.3220, lng: 5.0415 },
    { slug: 'angers', name: 'Angers', lat: 47.4784, lng: -0.5632 },
    { slug: 'nimes', name: 'Nîmes', lat: 43.8367, lng: 4.3601 },
    { slug: 'aix-en-provence', name: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474 },
  ],
};
